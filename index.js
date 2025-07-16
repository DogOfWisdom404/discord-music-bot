const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

console.log('Starting Discord bot...');
console.log('Token exists:', !!process.env.DISCORD_TOKEN);
console.log('Token starts with:', process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.substring(0, 10) + '...' : 'MISSING');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// When the client is ready, run this code
client.once('ready', () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
});

// Basic ping command
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.content === '!ping') {
        await message.reply('Pong!');
    }
});

// Error handling
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord with your bot token
console.log('Attempting to login...');
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
}); 