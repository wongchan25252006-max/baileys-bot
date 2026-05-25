const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
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

function getTypingTime(length) {
    if (length < 20) return 3000 + Math.random() * 2000;
    if (length < 50) return 7000 + Math.random() * 3000;
    return 12000 + Math.random() * 8000;
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) {
                console.log('Connection closed, reconnecting...');
                startBot();
            } else {
                console.log('Logged out. Delete auth_info_baileys/ and restart to re-scan QR.');
            }
        } else if (connection === 'open') {
            console.log('WONG CHAN AI IS RUNNING!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (msg.key.fromMe) continue;

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                '';

            if (!text.trim()) continue;

            const jid = msg.key.remoteJid;

            if (text === 'WONGCHAN2020') {
                await sock.sendMessage(jid, { text: 'Yes Mr. Chan. How can I help you?' });
                continue;
            }

            const typingTime = getTypingTime(text.length);
            console.log(`Typing for ${(typingTime / 1000).toFixed(1)}s...`);
            await sock.sendPresenceUpdate('composing', jid);
            await new Promise(resolve => setTimeout(resolve, typingTime));
            await sock.sendPresenceUpdate('paused', jid);

            try {
                const res = await axios.post(
                    'https://api.venice.ai/api/v1/chat/completions',
                    {
                        model: 'llama-3.3-70b',
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: text },
                        ],
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${VENICE_API_KEY}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                const reply = res.data.choices[0].message.content;
                await sock.sendMessage(jid, { text: reply });
            } catch (e) {
                console.error('Venice AI error:', e.message);
                await sock.sendMessage(jid, { text: 'Sorry, having issues. Please message again.' });
            }
        }
    });
}

startBot();
