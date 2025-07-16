const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
require('dotenv').config();

console.log('Starting Discord bot with health server...');

// Express server for Render health checks
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ 
        status: 'Discord bot is running!', 
        bot: client.user ? client.user.tag : 'Not logged in yet',
        timestamp: new Date() 
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        uptime: process.uptime(),
        servers: client.guilds ? client.guilds.cache.size : 0
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});

// Discord bot setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent  // ← Now enabled in Discord Portal
    ]
});

client.once('ready', () => {
    console.log(`✅ Ready! Logged in as ${client.user.tag}`);
    console.log(`🏠 Bot is in ${client.guilds.cache.size} server(s)`);
});

client.on('messageCreate', async (message) => {
    console.log(`📨 Message: "${message.content}" from ${message.author.username}`);
    
    if (message.author.bot) return;
    
    if (message.content === '!ping') {
        console.log('🏓 Ping command detected!');
        try {
            await message.reply('Pong!');
            console.log('✅ Successfully replied!');
        } catch (error) {
            console.error('❌ Failed to reply:', error);
        }
    }
});

// Error handling
client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

console.log('🔐 Attempting to login...');
client.login(process.env.DISCORD_TOKEN); 