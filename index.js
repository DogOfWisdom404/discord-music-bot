const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs').promises;
require('dotenv').config();

console.log('Starting Discord bot with health server and music notifications...');

// Spotify API variables
let spotifyToken = null;
let trackedArtists = new Set();

// Discord bot setup FIRST
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Express server for Render health checks
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ 
        status: 'Discord bot is running!', 
        bot: client.user ? client.user.tag : 'Not logged in yet',
        artistsTracked: trackedArtists.size,
        timestamp: new Date() 
    });
});

app.get('/health', (req, res) => {
    const isReady = client.isReady();
    res.status(isReady ? 200 : 503).json({ 
        status: isReady ? 'healthy' : 'unhealthy', 
        uptime: process.uptime(),
        servers: client.guilds ? client.guilds.cache.size : 0,
        artistsTracked: trackedArtists.size,
        botReady: isReady
    });
});

// Spotify functions
async function getSpotifyToken() {
    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', 
            'grant_type=client_credentials', 
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
                }
            }
        );
        
        spotifyToken = response.data.access_token;
        console.log('✅ Spotify token obtained');
        return spotifyToken;
    } catch (error) {
        console.error('❌ Failed to get Spotify token:', error.response?.data || error.message);
        return null;
    }
}

async function loadArtistsFromCSV() {
    try {
        const csvFiles = ['djentcore_n_beauty.csv', 'tiktok_live_songs.csv'];
        
        for (const fileName of csvFiles) {
            try {
                const csvData = await fs.readFile(fileName, 'utf-8');
                const lines = csvData.split('\n');
                
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    const columns = parseCSVLine(line);
                    
                    if (columns.length > 3) {
                        const artistNames = columns[3];
                        
                        if (artistNames && artistNames !== 'undefined' && artistNames.trim()) {
                            const artists = artistNames.split(',').map(name => name.trim());
                            
                            artists.forEach(artist => {
                                if (artist && artist !== 'undefined') {
                                    trackedArtists.add(artist);
                                }
                            });
                        }
                    }
                }
                
                console.log(`✅ Loaded artists from ${fileName}`);
            } catch (error) {
                console.log(`⚠️ Could not read ${fileName}:`, error.message);
            }
        }
        
        console.log(`🎵 Total unique artists to track: ${trackedArtists.size}`);
        
    } catch (error) {
        console.error('❌ Error loading artists:', error);
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

async function checkForNewReleases() {
    console.log('🔍 Checking for new releases...');
    
    if (!spotifyToken) {
        await getSpotifyToken();
    }
    
    // Check for releases in the last 7 days (increased from 3)
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    let newReleases = [];
    let checkedCount = 0;
    
    for (const artistName of trackedArtists) {
        try {
            // Search for artist
            const searchResponse = await axios.get(`https://api.spotify.com/v1/search`, {
                headers: { 'Authorization': `Bearer ${spotifyToken}` },
                params: { q: artistName, type: 'artist', limit: 1 }
            });
            
            if (searchResponse.data.artists.items.length === 0) continue;
            
            const artistId = searchResponse.data.artists.items[0].id;
            
                    // Get latest releases
            const releasesResponse = await axios.get(`https://api.spotify.com/v1/artists/${artistId}/albums`, {
                headers: { 'Authorization': `Bearer ${spotifyToken}` },
                params: { include_groups: 'album,single,compilation', limit: 20 }
            });
            // Check for recent releases
            for (const album of releasesResponse.data.items) {
                const releaseDate = new Date(album.release_date);
                if (releaseDate >= sevenDaysAgo) {
                    newReleases.push({
                        artistName: artistName,
                        name: album.name,
                        type: album.album_type,
                        releaseDate: album.release_date,
                        url: album.external_urls.spotify
                    });
                }
            }
            
            checkedCount++;
            await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
            
        } catch (error) {
            console.error(`❌ Error checking ${artistName}:`, error.message);
        }
    }
    
    console.log(`✅ Checked ${checkedCount} artists, found ${newReleases.length} new releases`);
    
    // Send notifications
    for (const release of newReleases) {
        await sendDiscordNotification(release);
    }
}

async function sendDiscordNotification(release) {
    try {
        const channel = client.channels.cache.get(process.env.NOTIFICATION_CHANNEL_ID);
        if (!channel) {
            console.error('❌ Notification channel not found!');
            return;
        }
        
        const embed = {
            color: 0x1DB954,
            title: '🎵 **NEW RELEASE ALERT!** 🎵',
            fields: [
                { name: '🎤 Artist', value: release.artistName, inline: true },
                { name: '🎶 Release', value: release.name, inline: true },
                { name: '📀 Type', value: release.type.charAt(0).toUpperCase() + release.type.slice(1), inline: true },
                { name: '📅 Released', value: release.releaseDate, inline: true },
                { name: '🎧 Listen', value: `[Spotify Link](${release.url})`, inline: true }
            ],
            footer: { text: '🎸 Time to create that cover!' },
            timestamp: new Date()
        };
        
        // Add your friend's Discord ID here
        const friendUserId = process.env.FRIEND_USER_ID; // Get this from Discord
        
        await channel.send({ 
            content: `<@${friendUserId}> New music alert! 🎵`, 
            embeds: [embed] 
        });
        
        console.log(`🔔 Notification sent for: ${release.artistName} - ${release.name}`);
        
    } catch (error) {
        console.error('❌ Error sending Discord notification:', error);
    }
}

// Add this near the top with other variables
let isChecking = false;
let lastCheckTime = 0;
let newReleases = [];

client.once('ready', async () => {
    console.log(`✅ Ready! Logged in as ${client.user.tag}`);
    console.log(`🏠 Bot is in ${client.guilds.cache.size} server(s)`);
    
    // Set bot presence
    client.user.setPresence({
        activities: [{ 
            name: 'for new music releases', 
            type: ActivityType.Watching 
        }],
        status: 'online',
    });

    // Start Express server after bot is ready
    app.listen(PORT, () => {
        console.log(`🌐 Health check server running on port ${PORT}`);
    });
    
    // Load artists and get Spotify token
    await loadArtistsFromCSV();
    await getSpotifyToken();
    
    // Update presence with artist count
    client.user.setPresence({
        activities: [{ 
            name: `${trackedArtists.size} artists for new music`, 
            type: ActivityType.Watching 
        }],
        status: 'online',
    });
});

client.on('messageCreate', async (message) => {
    console.log(`📨 Message: "${message.content}" from ${message.author.username} in ${message.guild?.name}`);
    
    if (message.author.bot) return;
    if (message.guild?.id !== process.env.TARGET_GUILD_ID) return; // Only respond in your server
    
    if (message.content === '!ping') {
        console.log('🏓 Ping command detected!');
        try {
            await message.reply('Pong! 🎵');
            console.log('✅ Successfully replied!');
        } catch (error) {
            console.error('❌ Failed to reply:', error);
        }
    }
    
    if (message.content === '!check') {
        const now = Date.now();
        const cooldown = 30000; // 30 seconds
        
        if (isChecking) {
            await message.reply('⏳ Already checking for releases, please wait...');
            return;
        }
        
        if (now - lastCheckTime < cooldown) {
            const timeLeft = Math.ceil((cooldown - (now - lastCheckTime)) / 1000);
            await message.reply(`⏰ Please wait ${timeLeft} seconds before checking again.`);
            return;
        }
        
        isChecking = true;
        lastCheckTime = now;
        
        await message.reply('🔍 Checking for new releases now...');
        
        try {
            await checkForNewReleases();
        } finally {
            isChecking = false;
        }
    }
    
    if (message.content === '!stats') {
        await message.reply(`📊 Currently tracking **${trackedArtists.size}** artists for new releases!`);
    }
});

// Schedule checks every 4 hours
cron.schedule('0 */4 * * *', () => {
    checkForNewReleases();
});

// Error handling
client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

console.log('🔐 Attempting to login...');
client.login(process.env.DISCORD_TOKEN); 

// Add this to your bot code (index.js)
// Keep-alive ping every 10 minutes
if (process.env.NODE_ENV === 'production') {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://discord-music-bot-8m2e.onrender.com';
    
    setInterval(async () => {
        try {
            await axios.get(`${RENDER_URL}/health`);
            console.log('💓 Keep-alive ping sent');
        } catch (error) {
            console.log('❌ Keep-alive ping failed:', error.message);
        }
    }, 10 * 60 * 1000); // Every 10 minutes
} 