const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

console.log('Starting Discord bot...');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.once('ready', () => {
    console.log(`✅ Ready! Logged in as ${client.user.tag}`);
    console.log(`🏠 Bot is in ${client.guilds.cache.size} server(s)`);
    
    // List servers the bot is in
    client.guilds.cache.forEach(guild => {
        console.log(`- Server: ${guild.name} (${guild.id})`);
    });
});

// Debug: Log ALL message events
client.on('messageCreate', async (message) => {
    console.log(`📨 Message received: "${message.content}" from ${message.author.username} in #${message.channel.name}`);
    
    if (message.author.bot) {
        console.log('🤖 Ignoring message from bot');
        return;
    }
    
    if (message.content === '!ping') {
        console.log('🏓 PING COMMAND DETECTED! Attempting to reply...');
        try {
            await message.reply('Pong!');
            console.log('✅ Successfully replied with Pong!');
        } catch (error) {
            console.error('❌ Failed to reply:', error);
        }
    } else {
        console.log(`ℹ️  Not a ping command: "${message.content}"`);
    }
});

// Error handling
client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

console.log('🔐 Attempting to login...');
client.login(process.env.DISCORD_TOKEN); 