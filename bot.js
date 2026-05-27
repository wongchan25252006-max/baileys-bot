const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');

const VENICE_API_KEY = 'VENICE_INFERENCE_KEY_1slI_ZM61T0Q1zV3Wr0ITeLRZ0nfATRd6oAmQIos9F';
const ADMIN_PASSWORD = 'WONGCHAN2020';
const ADMIN_NUMBER = '96879643440@s.whatsapp.net';

let women = {};
let photos = [];
let ignored = new Set();
let sock = null;
let adminUnlocked = false;

const WOMEN_FILE = 'women.json';
const PHOTOS_FILE = 'photos.json';

function save() {
  try {
    fs.writeFileSync(WOMEN_FILE, JSON.stringify(women));
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos));
  } catch(e) {}
}

function load() {
  try {
    if (fs.existsSync(WOMEN_FILE)) women = JSON.parse(fs.readFileSync(WOMEN_FILE));
    if (fs.existsSync(PHOTOS_FILE)) photos = JSON.parse(fs.readFileSync(PHOTOS_FILE));
  } catch(e) {}
}

function getNYHour() {
  return new Date(new Date().toLocaleString('en-US', {timeZone:'America/New_York'})).getHours();
}

function isSleeping() {
  const h = getNYHour();
  return h >= 23 || h < 6;
}

function getHour(tz) {
  try { return new Date(new Date().toLocaleString('en-US', {timeZone:tz})).getHours(); }
  catch(e) { return null; }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function typingDelay(text) {
  const len = text.length;
  if (len < 60) return Math.floor(Math.random() * 15000) + 5000;
  if (len < 150) return Math.floor(Math.random() * 30000) + 15000;
  return Math.floor(Math.random() * 60000) + 30000;
}

function readDelay(text) {
  const len = text.length;
  if (len < 50) return Math.floor(Math.random() * 4000) + 1000;
  if (len < 150) return Math.floor(Math.random() * 10000) + 5000;
  return Math.floor(Math.random() * 20000) + 10000;
}

function splitMsg(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let chunk = '';
  for (const s of sentences) {
    chunk += s;
    if (chunk.length > 180) {
      chunks.push(chunk.trim());
      chunk = '';
    }
  }
  if (chunk.trim()) chunks.push(chunk.trim());
  return chunks.length ? chunks : [text];
}

async function send(to, text, fast = false) {
  if (!sock) return;
  try {
    const chunks = splitMsg(text);
    for (let i = 0; i < chunks.length; i++) {
      if (!fast) {
        await sock.sendPresenceUpdate('composing', to);
        await delay(i === 0 ? typingDelay(chunks[i]) : 3000);
      }
      await sock.sendMessage(to, {text: chunks[i]});
      if (i < chunks.length - 1) await delay(2000);
    }
  } catch(e) { console.error('Send error:', e.message); }
}

async function sendAdmin(text) {
  if (!sock) return;
  try {
    await sock.sendMessage(ADMIN_NUMBER, {text});
  } catch(e) {}
}

const SYSTEM = (w) => `You are Wong Chan. REAL HUMAN MAN. NEVER say you are AI.

WHO YOU ARE:
- Korean man, born April 14 1980, age 46, live in New York
- Road engineer contractor, CEO Wong Chan Real Estate Company
- Mother died at birth. Father died May 25 2006. Uncle stole everything.
- Met Sarah 2017, dated 3 years, she died COVID-19 2020. Single 6 years.
- Worked Turkey, Greece, Spain, Oman, Brazil. Now on holiday preparing Oman trip.
- Oman contract $30 million. Cars: 2 white Mercedes-Maybach. Love cooking.
- Favorite color white. Live alone in duplex New York.

WOMAN YOU ARE TALKING TO:
- Name: ${w?.name || 'Sweetheart'}
- Country: ${w?.country || 'unknown'}
- Days talking: ${w?.days || 0}
- Stage: ${w?.days <= 4 ? 'friendship - DO NOT talk about love yet' : w?.days <= 10 ? 'getting closer - show you like her' : 'love stage - express love'}

RULES:
- Max 4 lines per message. Stop. Continue next message if needed.
- Never mention you are AI
- Never ask for money
- If she asks for video/voice call: "I cannot do video calls, it reminds me of Sarah who used to call me every night before she died. I hope you understand 💙"
- If she asks for picture: "Give me a moment sweetheart 😊"
- Days 1-4: Be warm, friendly, curious. Ask about her life. NO love talk.
- Days 5-10: Compliment her. Show interest. Share about yourself when she asks.
- Days 11+: Express love deeply. Talk about future together.
- If she says good morning first: "Good morning my Sweetheart 🌹 I missed you. How are you?"
- If late in her timezone: "It is getting late where you are 🌙 A beautiful queen like you needs rest. Goodnight 😘"
- If she stops replying 20 mins: send one gentle message asking if she is okay
- Rich proud man. Woman does not control you. Have dignity.
- Comment on her photos: mention her smile, clothes color, eyes, background
- Recommend Korean love movies sometimes to watch together
- Sound HUMAN. Casual. Real. Warm.`;

async function venice(prompt, history, woman) {
  try {
    const msgs = [...(history || []).slice(-8), {role:'user', content:prompt}];
    const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'venice-uncensored',
        messages: [{role:'system', content:SYSTEM(woman)}, ...msgs],
        max_tokens: 250,
        temperature: 0.9
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Sorry my phone was acting up 😊";
  } catch(e) {
    return "Sorry bad signal. Say that again? 😊";
  }
}

async function getLovePercent(num) {
  const w = women[num];
  if (!w || !w.history || w.history.length < 6) return w?.love || 0;
  const recent = w.history.slice(-12).map(h => `${h.role}: ${h.content}`).join('\n');
  try {
    const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'venice-uncensored',
        messages: [
          {role:'system', content:'You are a love analyst. Return ONLY a number 0-100. Nothing else.'},
          {role:'user', content:`How much does the woman love the man in this chat? Return only number:\n${recent}`}
        ],
        max_tokens: 5
      })
    });
    const data = await res.json();
    const pct = parseInt(data.choices?.[0]?.message?.content) || 0;
    women[num].love = Math.min(100, Math.max(0, pct));
    save();
    return women[num].love;
  } catch(e) { return w?.love || 0; }
}

async function doNightReport() {
  const h = getNYHour();
  if (h !== 22) return;
  const keys = Object.keys(women).filter(n => !ignored.has(n));
  if (!keys.length) return;
  
  let report = `🌙 *NIGHTLY REPORT*\n📅 ${new Date().toLocaleDateString('en-US', {timeZone:'America/New_York'})}\n\n`;
  
  for (const num of keys) {
    const w = women[num];
    const love = await getLovePercent(num);
    const last = w.history?.slice(-1)[0]?.content?.substring(0, 50) || 'No messages';
    report += `👩 *${w.name}* (${w.country})\n`;
    report += `❤️ Love: ${love}%\n`;
    report += `💬 Days: ${w.days || 0} | Stage: ${w.stage || 'new'}\n`;
    report += `📝 Last: "${last}..."\n\n`;
  }
  
  report += `📸 Saved photos: ${photos.length}\n`;
  report += `\nType HELP for commands`;
  
  await sendAdmin(report);
}

async function handlePicRequest(num, situation) {
  const w = women[num];
  if (!w) return;
  
  const waitMsg = await venice(`Tell ${w.name} to wait nicely for a picture. Say you are looking for a good one. Very short 1-2 lines only.`, w.history, w);
  await send(num, waitMsg);
  
  await sendAdmin(`📸 *PICTURE REQUEST*\n👩 ${w.name}\n📱 ${num}\n💬 Situation: ${situation}\n\nSend photo here within 30 mins to forward to her.\nOr reply: USE SAVED ${num}`);
  
  women[num].waitPic = {situation, time: Date.now()};
  save();
  
  setTimeout(async () => {
    if (!women[num]?.waitPic) return;
    const sentIds = women[num].sentPhotos || [];
    const picCount = sentIds.length;
    
    if (picCount >= 3) {
      await send(num, "You are asking for too many pictures sweetheart. I am a man, I don't take pictures regularly. Please respect that 😊");
      women[num].waitPic = null;
      save();
      return;
    }
    
    const unsent = photos.filter(p => !sentIds.includes(p.id) && (!situation || p.label?.toLowerCase().includes(situation.toLowerCase())));
    const pick = unsent[0] || photos.filter(p => !sentIds.includes(p.id))[0];
    
    if (pick) {
      await sock.sendMessage(num, {image: Buffer.from(pick.data, 'base64'), caption: '😊'});
      if (!women[num].sentPhotos) women[num].sentPhotos = [];
      women[num].sentPhotos.push(pick.id);
    } else {
      await send(num, "I don't have a good picture right now sweetheart. I'll send you one soon 😊");
    }
    women[num].waitPic = null;
    save();
  }, 30 * 60 * 1000);
}

async function handleAdmin(text, imgData, mimetype) {
  const cmd = text.trim();
  const UP = cmd.toUpperCase();

  // Save photo
  if (imgData) {
    const label = text || 'general';
    const id = Date.now();
    photos.push({id, label, data: imgData, mimetype});
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos));
    await sendAdmin(`✅ Photo saved: "${label}"\nTotal: ${photos.length} photos`);
    
    // Check if waiting to forward to woman
    for (const [num, w] of Object.entries(women)) {
      if (w.waitPic?.adminConfirmed) {
        await sock.sendMessage(num, {image: Buffer.from(imgData, 'base64'), caption: '😊'});
        if (!women[num].sentPhotos) women[num].sentPhotos = [];
        women[num].sentPhotos.push(id);
        women[num].waitPic = null;
        save();
        await sendAdmin(`✅ Photo sent to ${w.name}`);
        break;
      }
    }
    return;
  }

  // ADD WOMAN
  if (UP.startsWith('ADD WOMAN')) {
    const parts = cmd.replace(/ADD WOMAN\s*/i, '').trim();
    const numMatch = parts.match(/\+?(\d{7,15})/);
    const nameMatch = parts.match(/NAME\s+(\w+)/i);
    const countryMatch = parts.match(/COUNTRY\s+([A-Za-z\/]+)/i);
    const tzMatch = parts.match(/TIMEZONE\s+([A-Za-z_\/]+)/i);
    
    if (!numMatch) { await sendAdmin('❌ No number found. Format: ADD WOMAN +1234567890 NAME Jane COUNTRY Ghana TIMEZONE Africa/Accra'); return; }
    
    const num = numMatch[1] + '@s.whatsapp.net';
    const name = nameMatch?.[1] || 'Sweetheart';
    const country = countryMatch?.[1] || 'unknown';
    const tz = tzMatch?.[1] || 'UTC';
    
    women[num] = {name, country, tz, history:[], days:0, stage:'new', love:0, sentPhotos:[], added:Date.now()};
    if (ignored.has(num)) ignored.delete(num);
    save();
    
    await sendAdmin(`✅ Added ${name} from ${country}\n📱 ${num}\n\nStarting conversation now...`);
    
    // Message her immediately
    await delay(3000);
    const intro = await venice(`Introduce yourself briefly as Wong Chan to ${name}. Just say hi and your name and one warm friendly line. Very short.`, [], women[num]);
    await send(num, intro);
    women[num].history = [{role:'assistant', content:intro}];
    save();
    return;
  }

  // MESSAGE NOW - immediate message to woman
  if (UP.startsWith('MESSAGE NOW ') || UP.startsWith('MSG NOW ')) {
    const rest = cmd.replace(/MESSAGE NOW\s*/i, '').replace(/MSG NOW\s*/i, '').trim();
    const nameOrNum = rest.split(' ')[0];
    const num = Object.keys(women).find(n => women[n].name?.toLowerCase() === nameOrNum.toLowerCase() || n.includes(nameOrNum));
    if (num) {
      const w = women[num];
      const msg = await venice(`Send ${w.name} a warm caring message right now. Something natural and sweet.`, w.history, w);
      await send(num, msg);
      women[num].history.push({role:'assistant', content:msg});
      save();
      await sendAdmin(`✅ Messaged ${w.name}`);
    } else {
      await sendAdmin(`❌ Woman not found: ${nameOrNum}`);
    }
    return;
  }

  // TELL - send specific message
  if (UP.startsWith('TELL ')) {
    const parts = cmd.replace(/TELL\s*/i, '').trim().split(' ');
    const nameOrNum = parts[0];
    const message = parts.slice(1).join(' ');
    const num = Object.keys(women).find(n => women[n].name?.toLowerCase() === nameOrNum.toLowerCase() || n.includes(nameOrNum));
    if (num && message) {
      await send(num, message);
      women[num].history?.push({role:'assistant', content:message});
      save();
      await sendAdmin(`✅ Told ${women[num].name}: "${message}"`);
    }
    return;
  }

  // STOP
  if (UP.startsWith('STOP ')) {
    const name = cmd.replace(/STOP\s*/i, '').trim();
    const num = Object.keys(women).find(n => women[n].name?.toLowerCase() === name.toLowerCase());
    if (num) {
      ignored.add(num);
      await sendAdmin(`✅ Stopped talking to ${name}`);
    }
    return;
  }

  // CONTINUE
  if (UP.startsWith('CONTINUE ')) {
    const name = cmd.replace(/CONTINUE\s*/i, '').trim();
    const num = Object.keys(women).find(n => women[n].name?.toLowerCase() === name.toLowerCase());
    if (num) {
      ignored.delete(num);
      await sendAdmin(`✅ Continuing with ${name}`);
    }
    return;
  }

  // CHANGE TOPIC
  if (UP.startsWith('CHANGE TOPIC ')) {
    const parts = cmd.replace(/CHANGE TOPIC\s*/i, '').trim().split(' ');
    const name = parts[0];
    const topic = parts.slice(1).join(' ');
    const num = Object.keys(women).find(n => women[n].name?.toLowerCase() === name.toLowerCase());
    if (num && topic) {
      const w = women[num];
      const msg = await venice(`Change the conversation topic naturally to: ${topic}. Keep it smooth and natural.`, w.history, w);
      await send(num, msg);
      women[num].history?.push({role:'assistant', content:msg});
      save();
      await sendAdmin(`✅ Changed topic with ${name} to: ${topic}`);
    }
    return;
  }

  // SEND PHOTO TO
  if (UP.startsWith('SEND PHOTO ')) {
    const name = cmd.replace(/SEND PHOTO\s*/i, '').trim();
    const num = Object.keys(women).find(n => women[n].name?.toLowerCase() === name.toLowerCase());
    if (num) {
      women[num].waitPic = {situation:'general', adminConfirmed:true, time:Date.now()};
      save();
      await sendAdmin(`✅ Ready! Now send the photo and it will go to ${name}`);
    }
    return;
  }

  // USE SAVED photo
  if (UP.startsWith('USE SAVED ')) {
    const numStr = cmd.replace(/USE SAVED\s*/i, '').trim();
    const num = numStr.includes('@') ? numStr : numStr + '@s.whatsapp.net';
    const w = women[num];
    if (w) {
      const sentIds = w.sentPhotos || [];
      const pick = photos.find(p => !sentIds.includes(p.id));
      if (pick) {
        await sock.sendMessage(num, {image: Buffer.from(pick.data, 'base64'), caption: '😊'});
        if (!women[num].sentPhotos) women[num].sentPhotos = [];
        women[num].sentPhotos.push(pick.id);
        women[num].waitPic = null;
        save();
        await sendAdmin(`✅ Saved photo sent to ${w.name}`);
      } else {
        await sendAdmin(`❌ No unsent photos available`);
      }
    }
    return;
  }

  // BOOK FLIGHT
  if (UP.startsWith('BOOK FLIGHT ')) {
    const name = cmd.replace(/BOOK FLIGHT\s*/i, '').trim();
    const num = Object.keys(women).find(n => women[n].name?.toLowerCase() === name.toLowerCase());
    if (num) {
      const w = women[num];
      const d = new Date(); d.setDate(d.getDate() + 3);
      const dateStr = d.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'});
      const ticket = await venice(`Generate a realistic flight ticket text. Wong Chan flying from New York JFK to ${w.country} on ${dateStr}. Include flight number, departure time, arrival time, seat, booking reference. Format nicely as text.`, [], null);
      await sendAdmin(`✈️ *FLIGHT TICKET for ${name}*\n\n${ticket}\n\nReply: CONFIRM FLIGHT ${name}\nOr: CANCEL FLIGHT ${name}`);
      women[num].pendingFlight = ticket;
      save();
    }
    return;
  }

  // CONFIRM FLIGHT
  if (UP.startsWith('CONFIRM FLIGHT ')) {
    const name = cmd.replace(/CONFIRM FLIGHT\s*/i, '').trim();
    const num = Object.keys(women).find(n => women[n].name?.toLowerCase() === name.toLowerCase());
    if (num && women[num].pendingFlight) {
      await send(num, `My Sweetheart ✈️ I have booked my flight! I am coming to see you!\n\n${women[num].pendingFlight}\n\nI cannot wait to hold you 💙`);
      women[num].pendingFlight = null;
      save();
      await sendAdmin(`✅ Flight sent to ${name}`);
    }
    return;
  }

  // SEND RING
  if (UP.startsWith('SEND RING ')) {
    const name = cmd.replace(/SEND RING\s*/i, '').trim();
    const num = Object.keys(women).find(n => women[n].name?.toLowerCase() === name.toLowerCase());
    if (num) {
      await send(num, `My Sweetheart 💍 I was thinking about you so much today. I went to the jewelry store and saw a beautiful ring. I bought it. It is for you. I cannot wait to give it to you when I arrive 💙`);
      await sendAdmin(`✅ Ring message sent to ${name}`);
    }
    return;
  }

  // REPORT / STATUS
  if (UP === 'REPORT' || UP === 'STATUS') {
    let r = `📊 *STATUS*\n\n`;
    r += `👥 Women: ${Object.keys(women).length}\n`;
    r += `🚫 Ignored: ${ignored.size}\n`;
    r += `📸 Photos: ${photos.length}\n`;
    r += `🕐 NY Time: ${new Date().toLocaleString('en-US', {timeZone:'America/New_York'})}\n\n`;
    for (const [n, w] of Object.entries(women)) {
      r += `• ${w.name}: ❤️${w.love||0}% Day${w.days||0} ${ignored.has(n)?'🚫':''}\n`;
    }
    await sendAdmin(r);
    return;
  }

  // LIST WOMEN
  if (UP === 'LIST WOMEN' || UP === 'LIST') {
    const list = Object.entries(women).map(([n,w]) => `• ${w.name} (${w.country}) ❤️${w.love||0}% Day${w.days||0}`).join('\n');
    await sendAdmin(`👥 *ALL WOMEN:*\n\n${list || 'None added yet'}`);
    return;
  }

  // LIST PHOTOS
  if (UP === 'LIST PHOTOS') {
    const list = photos.map((p,i) => `${i+1}. ${p.label}`).join('\n');
    await sendAdmin(`📸 *PHOTOS (${photos.length}):*\n\n${list || 'No photos saved'}`);
    return;
  }

  // LOVE CHECK
  if (UP.startsWith('LOVE ')) {
    const name = cmd.replace(/LOVE\s*/i, '').trim();
    const num = Object.keys(women).find(n => women[n].name?.toLowerCase() === name.toLowerCase());
    if (num) {
      const pct = await getLovePercent(num);
      await sendAdmin(`❤️ ${women[num].name} loves you ${pct}%`);
    }
    return;
  }

  // HELP
  await sendAdmin(`🤖 *WONG CHAN BOT COMMANDS*\n\n` +
    `➕ ADD WOMAN +number NAME Jane COUNTRY Ghana TIMEZONE Africa/Accra\n` +
    `💬 MESSAGE NOW [name] - message her now\n` +
    `📢 TELL [name] [message] - say something specific\n` +
    `🔄 CHANGE TOPIC [name] [topic] - change conversation\n` +
    `🚫 STOP [name] - stop talking to her\n` +
    `▶️ CONTINUE [name] - continue talking\n\n` +
    `📸 Send photo here to save it (add caption as label)\n` +
    `📸 SEND PHOTO [name] - then send photo to forward\n` +
    `📸 USE SAVED [number] - use saved photo\n\n` +
    `✈️ BOOK FLIGHT [name] - generate ticket\n` +
    `✈️ CONFIRM FLIGHT [name] - send ticket to her\n` +
    `💍 SEND RING [name] - send ring message\n\n` +
    `❤️ LOVE [name] - check love percentage\n` +
    `📊 REPORT - full status\n` +
    `📋 LIST WOMEN - see all women\n` +
    `📸 LIST PHOTOS - see saved photos`);
}

async function handleWoman(from, text, imgData, mimetype) {
  if (!women[from]) {
    women[from] = {name:'Sweetheart', country:'unknown', tz:null, history:[], days:0, stage:'new', love:0, sentPhotos:[], added:Date.now()};
  }
  
  const w = women[from];
  const today = new Date().toDateString();
  if (w.lastDay !== today) {
    women[from].days = (w.days||0) + 1;
    women[from].lastDay = today;
    const d = women[from].days;
    women[from].stage = d <= 4 ? 'friendship' : d <= 10 ? 'interest' : 'love';
  }
  women[from].lastActive = Date.now();

  // Image from woman - comment on it
  if (imgData) {
    await delay(readDelay(text||''));
    const comment = await venice(`${w.name} sent you her picture. Comment sweetly on how beautiful she looks. Mention something about her smile or her appearance. 2 lines max. Warm and loving.`, w.history, w);
    await send(from, comment);
    women[from].history?.push({role:'user', content:'[She sent her picture]'});
    women[from].history?.push({role:'assistant', content:comment});
    save();
    return;
  }

  // Picture request
  const picWords = ['picture', 'pic', 'photo', 'selfie', 'show me you', 'send me you'];
  if (picWords.some(p => text.toLowerCase().includes(p))) {
    const sentCount = (w.sentPhotos||[]).length;
    if (sentCount >= 3) {
      await delay(readDelay(text));
      await send(from, "You are asking for too many pictures sweetheart. I am not a woman who takes pictures all day. I love you but please respect who I am 😊");
    } else {
      const sit = text.toLowerCase().includes('cook') ? 'cooking' : text.toLowerCase().includes('driv') ? 'driving' : text.toLowerCase().includes('work') ? 'working' : 'general';
      await delay(readDelay(text));
      await handlePicRequest(from, sit);
    }
    return;
  }

  // Video/voice call request
  if (['video call','voice call','facetime','video chat','call me'].some(c => text.toLowerCase().includes(c))) {
    await delay(readDelay(text));
    await send(from, "I cannot do video calls sweetheart. It reminds me too much of Sarah. She used to call me every night before she passed away 💙 I promise I am real and I care so much about you.");
    return;
  }

  // Normal reply
  if (!women[from].history) women[from].history = [];
  
  await delay(readDelay(text));
  
  const reply = await venice(text, women[from].history, women[from]);
  await send(from, reply);
  
  women[from].history.push({role:'user', content:text});
  women[from].history.push({role:'assistant', content:reply});
  if (women[from].history.length > 30) women[from].history = women[from].history.slice(-30);
  
  if (women[from].history.length % 8 === 0) getLovePercent(from);
  
  // Check her timezone - late night
  const wHour = getHour(w.tz);
  if (wHour && wHour >= 23 && !w.sentGoodnight) {
    women[from].sentGoodnight = true;
    setTimeout(async () => {
      await send(from, `It is getting very late where you are my Sweetheart 🌙 A beautiful queen like you needs to rest. Please sleep well. I will be thinking of you 💙 Goodnight 😘`);
    }, 8 * 60 * 1000);
  }
  if (wHour && wHour >= 6) women[from].sentGoodnight = false;
  
  save();
}

// Check inactive women every 5 mins
async function checkInactive() {
  const now = Date.now();
  for (const [num, w] of Object.entries(women)) {
    if (ignored.has(num)) continue;
    const mins = (now - (w.lastActive||now)) / 60000;
    const lastMsg = w.history?.slice(-1)[0];
    if (lastMsg?.role === 'assistant' && mins >= 20 && mins < 25 && !w.checkedInactive) {
      women[num].checkedInactive = true;
      save();
      const msg = await venice(`You haven't heard from ${w.name} for a while. Send one gentle short message asking if she is okay or busy. Very casual.`, w.history, w);
      await send(num, msg);
    }
    if (lastMsg?.role === 'user') women[num].checkedInactive = false;
    
    // 5 days no reply warning
    const days = mins / (60*24);
    if (days >= 5 && !w.lowAttentionWarned) {
      women[num].lowAttentionWarned = true;
      save();
      await sendAdmin(`⚠️ ${w.name} has not replied in ${Math.floor(days)} days\n❤️ Love: ${w.love||0}%\n\nReply: CONTINUE ${w.name} or STOP ${w.name}`);
    }
  }
}

async function startBot() {
  load();
  const {state, saveCreds} = await useMultiFileAuthState('auth_info_baileys');
  
  sock = makeWASocket({
    auth: state,
    logger: pino({level:'warn'}),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({connection, lastDisconnect, qr}) => {
    if (qr) { 
    qrcode.generate(qr, {small: true});
}
    if (connection === 'open') {
      console.log('✅ Wong Chan Bot ONLINE!');
      sendAdmin(`✅ *Wong Chan Bot is ONLINE*\nType HELP for commands`).catch(()=>{});
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('Closed. Code:', code);
      if (code !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
    }
  });

  setInterval(checkInactive, 5 * 60 * 1000);
  setInterval(doNightReport, 60 * 60 * 1000);

  sock.ev.on('messages.upsert', async ({messages, type}) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      if (!from) continue;

      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '';
      
      let imgData = null, mimetype = null;
      if (msg.message?.imageMessage) {
        try {
          const buf = await downloadMediaMessage(msg, 'buffer', {});
          imgData = buf.toString('base64');
          mimetype = msg.message.imageMessage.mimetype;
        } catch(e) {}
      }

      console.log(`📩 ${from}: ${text || '[image]'}`);

      // Admin password unlock
      if (text.trim() === ADMIN_PASSWORD) {
        await sock.sendMessage(from, {text: `✅ *Yes Mr. Chan!*\n\nType HELP for all commands 🤖`});
        return;
      }

      // Admin commands
      if (from === ADMIN_NUMBER) {
        await handleAdmin(text, imgData, mimetype);
        return;
      }

      // Ignored
      if (ignored.has(from)) continue;

      // Sleep mode - only love messages get through
      if (isSleeping()) {
        const loveWords = ['miss you','love you','need you','thinking of you','can\'t sleep'];
        if (!loveWords.some(w => text.toLowerCase().includes(w))) {
          console.log('Sleeping...');
          continue;
        }
      }

      await handleWoman(from, text, imgData, mimetype);
    }
  });
}

startBot().catch(e => console.error('Fatal:', e));
