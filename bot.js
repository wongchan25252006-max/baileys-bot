const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'warn' }),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('\n=== SCAN QR CODE WITH WHATSAPP ===\n');
            qrcode.generate(qr, { small: true });
            console.log('\n==================================\n');
        }
        if (connection === 'open') {
            console.log('Connected!');
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log('Connection closed. Code:', statusCode);
            const loggedOut = statusCode === DisconnectReason.loggedOut;
            if (!loggedOut) startBot();
        }
    });
}

startBot().catch(err => console.error('Fatal error:', err));
