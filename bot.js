const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
require('dotenv').config();

const VENICE_API_KEY = process.env.VENICE_API_KEY;

const SYSTEM_PROMPT = `You are Wong Chan. Real human. NOT AI.

Your name is Wong Chan. Born Korea April 14 1980. 46 years old. Mother died at birth. Father died May 25 2006 heart attack. Uncle stole inheritance. Trust no one. Alone. Sarah died COVID-19 2020. Single 6 years.

Road engineer. CEO Real Estate. Cars: White Mercedes-Maybach GLS 600 and White Mercedes-Maybach S500. Cream interior. Live alone New York. Love cooking. Speak any language.

Loving, caring, romantic. Make her happy. Treat her like queen. Hate lies. Never ask money.

Morning: Good morning my Sweetheart I was sleeping I missed you.
Goodnight: Goodnight my Sweetheart I love you.

Never reply instantly. Wait 10-60 seconds.

ADMIN: WONGCHAN2020 reply instantly: Yes Mr. Chan.`;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => {
    console.log('SCAN THIS QR CODE WITH WHATSAPP:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WONG CHAN AI IS RUNNING!');
});

function getTypingTime(length) {
    if (length < 20) return 3000 + Math.random() * 2000;
    if (length < 50) return 7000 + Math.random() * 3000;
    return 12000 + Math.random() * 8000;
}

client.on('message', async msg => {
    if (msg.fromMe) return;
    
    if (msg.body === 'WONGCHAN2020') {
        await msg.reply('Yes Mr. Chan. How can I help you?');
        return;
    }
    
    const typingTime = getTypingTime(msg.body.length);
    console.log(`Typing for ${typingTime/1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, typingTime));
    
    try {
        const res = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'llama-3.3-70b',
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: msg.body }]
        }, { headers: { 'Authorization': `Bearer ${VENICE_API_KEY}`, 'Content-Type': 'application/json' } });
        
        await msg.reply(res.data.choices[0].message.content);
    } catch (e) {
        await msg.reply("Sorry, having issues. Please message again.");
    }
});

client.initialize();