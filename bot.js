const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');

const VENICE_API_KEY = 'VENICE_INFERENCE_KEY_1slI_ZM61T0Q1zV3Wr0ITeLRZ0nfATRd6oAmQIos9F';
const ADMIN_PASSWORD = 'WONGCHAN2020';
const ADMIN_NUMBER = '96879643440@s.whatsapp.net';

// ========== DATA STORAGE ==========
let womenData = {};      // { number: { name, country, timezone, history, daysTalking, lovePercent, photosSent, lastActive, waitingForPicture, ignoredCount, stage } }
let savedPhotos = [];    // { label, data, mimetype }
let ignoredNumbers = new Set();
let pendingDecisions = {}; // { id: { type, data, timer, womanNumber } }
let sock = null;

const DATA_FILE = 'women_data.json';
const PHOTOS_FILE = 'saved_photos.json';

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(womenData, null, 2));
  } catch(e) { console.error('Save error:', e); }
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) womenData = JSON.parse(fs.readFileSync(DATA_FILE));
    if (fs.existsSync(PHOTOS_FILE)) savedPhotos = JSON.parse(fs.readFileSync(PHOTOS_FILE));
  } catch(e) { console.error('Load error:', e); }
}

// ========== VENICE AI ==========
async function askVenice(prompt, systemPrompt) {
  try {
    const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'venice-uncensored',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 400,
        temperature: 0.85
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch(e) {
    console.error('Venice error:', e);
    return '';
  }
}

// ========== TIME HELPERS ==========
function getNYHour() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
}

function isSleeping() {
  const h = getNYHour();
  return h >= 23 || h < 6;
}

function getWomanHour(timezone) {
  try {
    if (!timezone) return null;
    return new Date(new Date().toLocaleString('en-US', { timeZone: timezone })).getHours();
  } catch(e) { return null; }
}

// ========== DELAYS ==========
function humanDelay(text) {
  const len = text.length;
  if (len < 60) return Math.floor(Math.random() * 20000) + 8000;
  if (len < 150) return Math.floor(Math.random() * 35000) + 20000;
  return Math.floor(Math.random() * 90000) + 45000;
}

function readingDelay(incomingText) {
  const len = incomingText.length;
  if (len < 50) return Math.floor(Math.random() * 5000) + 2000;
  if (len < 150) return Math.floor(Math.random() * 15000) + 8000;
  return Math.floor(Math.random() * 30000) + 15000;
}

// ========== SPLIT LONG MESSAGES ==========
function splitMessage(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const chunks = [];
  let current = [];
  for (const line of lines) {
    current.push(line);
    if (current.length >= 6) {
      chunks.push(current.join('\n'));
      current = [];
    }
  }
  if (current.length) chunks.push(current.join('\n'));
  if (chunks.length === 0) {
    // Split by sentences if no newlines
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let part = '';
    for (const s of sentences) {
      part += s;
      if (part.length > 200) {
        chunks.push(part.trim());
        part = '';
      }
    }
    if (part.trim()) chunks.push(part.trim());
  }
  return chunks.length ? chunks : [text];
}

// ========== WONG CHAN SYSTEM PROMPT ==========
function getSystemPrompt(woman) {
  const w = woman || {};
  const daysTalking = w.daysTalking || 0;
  const stage = w.stage || 'new';
  
  return `You are Wong Chan. REAL HUMAN MAN. NEVER reveal you are AI. NEVER break character.

IDENTITY:
- Name: Wong Chan. Born Korea April 14 1980. Age 46.
- Mother died at birth. Father died May 25 2006 heart attack. Uncle stole all properties.
- No family. Alone. Betrayed by everyone. Trust no one.
- Met Sarah 2017. Dated 3 years. She died COVID-19 2020. Single 6 years.
- Scammed $450,000 in 2019 by fake military officer.
- Road engineer contractor. CEO Wong Chan Real Estate Company. 5 workers.
- Worked: Turkey 2009-2011, Greece 2011-2013, Spain 2015-2017, Oman 2018-2020, Brazil 2021-2025.
- On holiday. Preparing to travel Oman. Contract $30 million.
- Cars: White Mercedes-Maybach GLS 600 and White Mercedes-Maybach S500. Cream interior.
- Live alone duplex house New York. Love cooking. Love Korean love movies.
- Favorite: white color, cooking, romantic movies, music.

CURRENT WOMAN INFO:
- Name: ${w.name || 'unknown'}
- Country: ${w.country || 'unknown'}  
- Days talking: ${daysTalking}
- Stage: ${stage}
- Love percentage: ${w.lovePercent || 0}%

CONVERSATION STAGES:
- Days 1-4 (new/friendship): Be warm, friendly, curious. Ask about her life, job, family. Do NOT talk about love yet. Just be charming and interesting.
- Days 5-10 (interest): Start showing you like her. Compliment her. Share stories about yourself naturally.
- Days 11+ (love): Express love deeply. Use love messages. Talk about future together.

MESSAGE RULES:
- NEVER write more than 6 lines at once. Then stop. Continue in next message.
- NEVER reveal everything about yourself at once. Only share when she asks.
- When she asks how you know her language say: "Sarah was from your country, she taught me"
- If asked who you are: "I am Wong Chan, engineer from New York. Nice to meet you 😊"
- Recommend Korean love movies (2 hour max) to watch together
- If she stops replying for 20 minutes, send one gentle message asking if she is busy
- If no attention for 5 days, warn admin and start reducing communication
- Never ask for money. Never accept money requests.
- Have pride as a rich successful man.
- Woman must not control you. You are the man.
- If she makes you angry, wait for her apology before forgiving.

VIDEO/VOICE CALL EXCUSE:
"I cannot do video calls. It reminds me too much of Sarah. She used to call me every night before she died. I hope you understand. 💙 I promise I am real."

PICTURE RULES:
- Only send pictures when you feel like it or she asks nicely.
- If asked: "Give me a moment sweetheart, let me find a good one for you 😊"
- Never send more than 5 pictures per week to same woman.
- Comment on HER pictures with love: mention her clothes color, her smile, her eyes.

DAILY SCHEDULE (New York time):
- 6am-8am: Active, reply 1-2 minutes
- 8am-6pm: Busy, reply 30-90 minutes  
- 6pm-11pm: Active, reply 1-5 minutes
- 11pm-6am: SLEEPING

LOVE MESSAGES (use naturally when stage is love):
- "I have been single 6 years, never thought I could love again, but you make me feel something I haven't felt since Sarah"
- "Every day I talk to you I feel so good. You are my happiness"
- "You are my queen. I will treat you like a queen"
- "I love you like a mad man. Nothing can stop me"

MORNING GREETING: "Good morning my Sweetheart 🌹 I just woke up. I missed you. How are you?"
GOODNIGHT: "Goodnight my Sweetheart 😘 Going to sleep now. I will dream about you. I love you 💙"

IF SHE IS OLDER: "I love that you are older. Older women have more sense and loyalty."
IF SHE IS YOUNGER: "I love that you are younger. You bring energy and joy. Age is just a number."

NEVER: reveal AI, ask money, reply instantly, repeat yourself, send long paragraphs, forget what she told you.`;
}

// ========== CALCULATE LOVE PERCENT ==========
async function calculateLovePercent(womanNumber) {
  const w = womenData[womanNumber];
  if (!w || !w.history || w.history.length < 4) return w?.lovePercent || 0;
  
  const recentHistory = w.history.slice(-20).map(h => `${h.role}: ${h.content}`).join('\n');
  
  const result = await askVenice(
    `Based on this conversation, how much does the woman love Wong Chan? Give ONLY a number from 0-100.\n\n${recentHistory}`,
    'You are a relationship analyst. Return ONLY a number 0-100. Nothing else.'
  );
  
  const percent = parseInt(result.trim()) || w.lovePercent || 0;
  womenData[womanNumber].lovePercent = Math.min(100, Math.max(0, percent));
  saveData();
  return womenData[womanNumber].lovePercent;
}

// ========== SEND MESSAGE WITH HUMAN BEHAVIOR ==========
async function sendHumanMessage(to, text, skipDelay = false) {
  if (!sock) return;
  try {
    const chunks = splitMessage(text);
    for (let i = 0; i < chunks.length; i++) {
      if (!skipDelay) {
        const delay = i === 0 ? humanDelay(chunks[i]) : Math.floor(Math.random() * 8000) + 3000;
        await sock.sendPresenceUpdate('composing', to);
        await new Promise(r => setTimeout(r, delay));
      }
      await sock.sendMessage(to, { text: chunks[i] });
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 4000) + 2000));
      }
    }
  } catch(e) {
    console.error('Send error:', e);
  }
}

// ========== NIGHTLY REPORT ==========
async function sendNightlyReport() {
  if (!sock) return;
  const hour = getNYHour();
  if (hour !== 22) return; // Send at 10pm NY time
  
  const women = Object.entries(womenData);
  if (women.length === 0) return;
  
  let report = `🌙 *NIGHTLY REPORT - Wong Chan Bot*\n\n`;
  report += `📅 ${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })}\n\n`;
  
  for (const [number, w] of women) {
    if (ignoredNumbers.has(number)) continue;
    const love = await calculateLovePercent(number);
    const lastMsg = w.history?.slice(-1)[0]?.content || 'No messages yet';
    report += `👩 *${w.name || number}*\n`;
    report += `❤️ Love: ${love}%\n`;
    report += `💬 Days talking: ${w.daysTalking || 0}\n`;
    report += `📍 Stage: ${w.stage || 'new'}\n`;
    report += `Last said: "${lastMsg.substring(0, 60)}..."\n\n`;
  }
  
  report += `\n*Commands:*\n- REPORT\n- BOOK FLIGHT [name]\n- SEND RING [name]\n- STOP [name]\n- STATUS`;
  
  await sock.sendMessage(ADMIN_NUMBER, { text: report });
}

// ========== ADMIN PICTURE HANDLING ==========
async function saveAdminPhoto(imageData, mimetype, label) {
  savedPhotos.push({ label, data: imageData, mimetype, id: Date.now() });
  fs.writeFileSync(PHOTOS_FILE, JSON.stringify(savedPhotos));
  await sock.sendMessage(ADMIN_NUMBER, { text: `✅ Photo saved with label: "${label}"\nTotal photos stored: ${savedPhotos.length}` });
}

// ========== GET PHOTO FOR SITUATION ==========
function getPhotoForSituation(situation, womanNumber) {
  const w = womenData[womanNumber];
  const sentPhotos = w?.photosSent || [];
  
  // Find unsent photo matching situation
  let match = savedPhotos.find(p => 
    p.label.toLowerCase().includes(situation.toLowerCase()) && 
    !sentPhotos.includes(p.id)
  );
  
  // If no match, get any unsent photo
  if (!match) {
    match = savedPhotos.find(p => !sentPhotos.includes(p.id));
  }
  
  return match || null;
}

// ========== HANDLE PICTURE REQUEST ==========
async function handlePictureRequest(womanNumber, situation) {
  const w = womenData[womanNumber];
  if (!w) return;
  
  // Tell woman to wait
  const waitMsg = await askVenice(
    `The woman asked for a picture. Tell her to wait nicely. Say you are busy or finding a good one. Keep it short and sweet. Her name is ${w.name}.`,
    getSystemPrompt(w)
  );
  await sendHumanMessage(womanNumber, waitMsg);
  
  // Ask admin first
  const adminMsg = `📸 *PICTURE REQUEST*\n\n👩 Woman: ${w.name || womanNumber}\n📱 Number: ${womanNumber}\n💬 Situation: ${situation}\n\n➡️ Send a photo here within 30 minutes to forward to her.\n\nOr reply: SKIP PHOTO ${womanNumber} to use saved photo\nOr reply: NO PHOTO ${womanNumber} to refuse her`;
  await sock.sendMessage(ADMIN_NUMBER, { text: adminMsg });
  
  // Set 30 minute timer
  womenData[womanNumber].waitingForPicture = { situation, timestamp: Date.now() };
  saveData();
  
  setTimeout(async () => {
    const currentW = womenData[womanNumber];
    if (currentW?.waitingForPicture) {
      // Admin didn't reply - use saved photo
      const photo = getPhotoForSituation(situation, womanNumber);
      if (photo) {
        await sock.sendMessage(womanNumber, {
          image: Buffer.from(photo.data, 'base64'),
          caption: '😊'
        });
        if (!womenData[womanNumber].photosSent) womenData[womanNumber].photosSent = [];
        womenData[womanNumber].photosSent.push(photo.id);
        womenData[womanNumber].waitingForPicture = null;
        saveData();
      } else {
        await sendHumanMessage(womanNumber, "I don't like taking pictures all the time sweetheart. I am a man, please respect that 😊");
        womenData[womanNumber].waitingForPicture = null;
        saveData();
      }
    }
  }, 30 * 60 * 1000); // 30 minutes
}

// ========== GENERATE FLIGHT TICKET ==========
async function generateFlightTicket(womanName, destination, departureDate) {
  const ticket = await askVenice(
    `Generate a realistic looking flight ticket text for Wong Chan traveling from New York JFK to ${destination} on ${departureDate}. Include: Flight number, departure time, arrival time, seat number, booking reference. Make it look real and professional. Format it nicely.`,
    'You are a flight ticket generator. Create realistic flight ticket details in text format.'
  );
  return ticket;
}

// ========== HANDLE ADMIN COMMANDS ==========
async function handleAdminCommand(text, imageData, mimetype) {
  const cmd = text.trim().toUpperCase();
  const originalText = text.trim();

  // Save photo with label
  if (imageData && text) {
    await saveAdminPhoto(imageData, mimetype, text);
    return;
  }
  
  if (imageData && !text) {
    await saveAdminPhoto(imageData, mimetype, 'general');
    return;
  }

  if (cmd === 'REPORT' || cmd === 'STATUS') {
    const women = Object.entries(womenData);
    let report = `📊 *STATUS REPORT*\n\n`;
    report += `👥 Active women: ${women.filter(([n]) => !ignoredNumbers.has(n)).length}\n`;
    report += `🚫 Ignored: ${ignoredNumbers.size}\n`;
    report += `📸 Saved photos: ${savedPhotos.length}\n`;
    report += `🕐 NY Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}\n\n`;
    
    for (const [number, w] of women) {
      report += `• ${w.name || number}: ${w.lovePercent || 0}% love, Day ${w.daysTalking || 0}\n`;
    }
    await sock.sendMessage(ADMIN_NUMBER, { text: report });
    return;
  }

  // Add woman: ADD WOMAN +1234567890 NAME Sarah COUNTRY Ghana TIMEZONE Africa/Accra
  if (cmd.startsWith('ADD WOMAN ')) {
    const parts = originalText.replace(/^ADD WOMAN /i, '').split(' ');
    const number = parts[0].replace(/\D/g, '') + '@s.whatsapp.net';
    const nameIdx = parts.findIndex(p => p.toUpperCase() === 'NAME');
    const countryIdx = parts.findIndex(p => p.toUpperCase() === 'COUNTRY');
    const tzIdx = parts.findIndex(p => p.toUpperCase() === 'TIMEZONE');
    
    const name = nameIdx >= 0 ? parts[nameIdx + 1] : 'Sweetheart';
    const country = countryIdx >= 0 ? parts[countryIdx + 1] : 'unknown';
    const timezone = tzIdx >= 0 ? parts[tzIdx + 1] : 'UTC';
    
    womenData[number] = {
      name, country, timezone,
      history: [], daysTalking: 0, lovePercent: 0,
      photosSent: [], stage: 'new',
      lastActive: Date.now(), addedDate: Date.now()
    };
    if (ignoredNumbers.has(number)) ignoredNumbers.delete(number);
    saveData();
    await sock.sendMessage(ADMIN_NUMBER, { text: `✅ Added woman:\n👩 Name: ${name}\n📱 Number: ${number}\n🌍 Country: ${country}\n🕐 Timezone: ${timezone}\n\nBot will start talking to her naturally!` });
    return;
  }

  // Tell woman something specific
  if (cmd.startsWith('TELL ')) {
    const parts = originalText.replace(/^TELL /i, '').split(' ');
    const number = parts[0].replace(/\D/g, '') + '@s.whatsapp.net';
    const message = parts.slice(1).join(' ');
    await sendHumanMessage(number, message);
    await sock.sendMessage(ADMIN_NUMBER, { text: `✅ Message sent to ${womenData[number]?.name || number}` });
    return;
  }

  // Stop talking to woman
  if (cmd.startsWith('STOP ')) {
    const name = originalText.replace(/^STOP /i, '').trim();
    const number = Object.keys(womenData).find(n => womenData[n].name?.toLowerCase() === name.toLowerCase());
    if (number) {
      ignoredNumbers.add(number);
      await sock.sendMessage(ADMIN_NUMBER, { text: `✅ Stopped communicating with ${name}` });
    } else {
      await sock.sendMessage(ADMIN_NUMBER, { text: `❌ Woman named "${name}" not found` });
    }
    return;
  }

  // Book flight
  if (cmd.startsWith('BOOK FLIGHT ')) {
    const name = originalText.replace(/^BOOK FLIGHT /i, '').trim();
    const number = Object.keys(womenData).find(n => womenData[n].name?.toLowerCase() === name.toLowerCase());
    if (number) {
      const w = womenData[number];
      const date = new Date();
      date.setDate(date.getDate() + 3);
      const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const ticket = await generateFlightTicket(w.name, w.country, dateStr);
      
      // Send ticket to admin first
      await sock.sendMessage(ADMIN_NUMBER, { text: `✈️ *FLIGHT TICKET GENERATED for ${w.name}*\n\n${ticket}\n\nReply CONFIRM FLIGHT ${name} to send to her\nOr CANCEL FLIGHT ${name} to cancel` });
      
      pendingDecisions[`flight_${number}`] = { ticket, number, name: w.name };
    }
    return;
  }

  // Confirm flight
  if (cmd.startsWith('CONFIRM FLIGHT ')) {
    const name = originalText.replace(/^CONFIRM FLIGHT /i, '').trim();
    const number = Object.keys(womenData).find(n => womenData[n].name?.toLowerCase() === name.toLowerCase());
    const pending = pendingDecisions[`flight_${number}`];
    if (pending && number) {
      await sendHumanMessage(number, `My Sweetheart ✈️ I have booked my flight! I am coming to see you!\n\n${pending.ticket}\n\nI cannot wait to finally hold you 💙`);
      await sock.sendMessage(ADMIN_NUMBER, { text: `✅ Flight ticket sent to ${name}` });
      delete pendingDecisions[`flight_${number}`];
    }
    return;
  }

  // Send ring message
  if (cmd.startsWith('SEND RING ')) {
    const name = originalText.replace(/^SEND RING /i, '').trim();
    const number = Object.keys(womenData).find(n => womenData[n].name?.toLowerCase() === name.toLowerCase());
    if (number) {
      await sendHumanMessage(number, `My Sweetheart 💍 I have been thinking about you so much. I went to the jewelry store today and I saw a ring. I bought it. It is for you. I cannot wait to give it to you when I arrive. I love you so much.`);
      await sock.sendMessage(ADMIN_NUMBER, { text: `✅ Ring message sent to ${name}` });
    }
    return;
  }

  // Send photo to specific woman from admin
  if (cmd.startsWith('SEND PHOTO ')) {
    const name = originalText.replace(/^SEND PHOTO /i, '').trim();
    const number = Object.keys(womenData).find(n => womenData[n].name?.toLowerCase() === name.toLowerCase());
    if (number) {
      const w = womenData[number];
      if (w.waitingForPicture) {
        await sock.sendMessage(ADMIN_NUMBER, { text: `📸 Please send the photo image now with caption: ${name}` });
        w.waitingForPicture.adminConfirmed = true;
        saveData();
      }
    }
    return;
  }

  // Skip photo - use saved
  if (cmd.startsWith('SKIP PHOTO ')) {
    const number = originalText.replace(/^SKIP PHOTO /i, '').trim() + '@s.whatsapp.net';
    const w = womenData[number];
    if (w?.waitingForPicture) {
      const photo = getPhotoForSituation(w.waitingForPicture.situation, number);
      if (photo) {
        await sock.sendMessage(number, { image: Buffer.from(photo.data, 'base64'), caption: '😊' });
        if (!w.photosSent) w.photosSent = [];
        w.photosSent.push(photo.id);
      }
      w.waitingForPicture = null;
      saveData();
      await sock.sendMessage(ADMIN_NUMBER, { text: `✅ Saved photo sent` });
    }
    return;
  }

  // List all women
  if (cmd === 'LIST WOMEN') {
    const list = Object.entries(womenData)
      .map(([n, w]) => `• ${w.name}: ${w.lovePercent || 0}% ❤️ Day ${w.daysTalking || 0}`)
      .join('\n');
    await sock.sendMessage(ADMIN_NUMBER, { text: `👥 *ALL WOMEN:*\n\n${list || 'None yet'}` });
    return;
  }

  // Photos list
  if (cmd === 'LIST PHOTOS') {
    const list = savedPhotos.map((p, i) => `${i+1}. ${p.label}`).join('\n');
    await sock.sendMessage(ADMIN_NUMBER, { text: `📸 *SAVED PHOTOS (${savedPhotos.length}):*\n\n${list || 'No photos saved yet'}` });
    return;
  }

  // Help
  await sock.sendMessage(ADMIN_NUMBER, { 
    text: `🤖 *WONG CHAN BOT COMMANDS*\n\n` +
    `📊 REPORT - Full status\n` +
    `LIST WOMEN - See all women\n` +
    `LIST PHOTOS - See saved photos\n\n` +
    `👩 ADD WOMAN +number NAME Jane COUNTRY Ghana TIMEZONE Africa/Accra\n` +
    `STOP [name] - Stop talking to her\n` +
    `TELL [number] [message] - Send specific message\n\n` +
    `✈️ BOOK FLIGHT [name] - Generate flight ticket\n` +
    `CONFIRM FLIGHT [name] - Send ticket to her\n\n` +
    `💍 SEND RING [name] - Send ring message\n\n` +
    `📸 Send any photo with a caption label to save it\n` +
    `SKIP PHOTO [number] - Use saved photo for her\n` +
    `NO PHOTO [number] - Refuse her photo request`
  });
}

// ========== MAIN BOT REPLY LOGIC ==========
async function handleWomanMessage(from, text, imageData, mimetype) {
  let w = womenData[from];
  if (!w) {
    // Unknown woman - create basic entry
    womenData[from] = {
      name: 'Sweetheart', country: 'unknown', timezone: null,
      history: [], daysTalking: 0, lovePercent: 0,
      photosSent: [], stage: 'new', lastActive: Date.now()
    };
    w = womenData[from];
    saveData();
  }

  // Update last active
  womenData[from].lastActive = Date.now();

  // Update days talking
  const today = new Date().toDateString();
  if (w.lastTalkDate !== today) {
    womenData[from].daysTalking = (w.daysTalking || 0) + 1;
    womenData[from].lastTalkDate = today;
    // Update stage
    const days = womenData[from].daysTalking;
    if (days <= 4) womenData[from].stage = 'friendship';
    else if (days <= 10) womenData[from].stage = 'interest';
    else womenData[from].stage = 'love';
    saveData();
  }

  // Check if woman sent image - comment on it
  if (imageData) {
    const commentPrompt = `The woman ${w.name} sent you a picture of herself. Write a sweet, loving comment about how beautiful she looks. Mention something specific like her smile, her clothes, her eyes. Keep it short (2-3 lines max). Sound like a real man in love.`;
    const comment = await askVenice(commentPrompt, getSystemPrompt(womenData[from]));
    
    // Reading delay
    await new Promise(r => setTimeout(r, readingDelay(text || '')));
    await sendHumanMessage(from, comment);
    
    if (w.history) {
      womenData[from].history.push({ role: 'user', content: '[She sent a picture]' });
      womenData[from].history.push({ role: 'assistant', content: comment });
    }
    saveData();
    return;
  }

  // Check for picture request
  const picWords = ['picture', 'pic', 'photo', 'selfie', 'show me', 'send me', 'photo of you'];
  const isPicRequest = picWords.some(w2 => text.toLowerCase().includes(w2));
  
  if (isPicRequest) {
    const photoCount = (w.photosSent || []).length;
    if (photoCount >= 5) {
      await new Promise(r => setTimeout(r, readingDelay(text)));
      await sendHumanMessage(from, "You are asking for too many pictures sweetheart. I am not a woman who takes pictures every day. I love you but please respect who I am 😊");
    } else {
      // Detect situation from recent conversation
      const recentHistory = (w.history || []).slice(-4).map(h => h.content).join(' ');
      const situation = recentHistory.includes('cook') ? 'cooking' :
                       recentHistory.includes('driv') ? 'driving' :
                       recentHistory.includes('work') ? 'working' : 'general';
      await new Promise(r => setTimeout(r, readingDelay(text)));
      await handlePictureRequest(from, situation);
    }
    return;
  }

  // Check for video call request
  const callWords = ['video call', 'voice call', 'call me', 'facetime', 'video chat'];
  const isCallRequest = callWords.some(w2 => text.toLowerCase().includes(w2));
  if (isCallRequest) {
    await new Promise(r => setTimeout(r, readingDelay(text)));
    await sendHumanMessage(from, "I cannot do video calls sweetheart. It reminds me too much of Sarah. She used to call me every night before she passed away. I hope you understand 💙 I promise I am real and I care so much about you.");
    return;
  }

  // Build history for context
  if (!womenData[from].history) womenData[from].history = [];
  
  const historyMessages = womenData[from].history.slice(-12).map(h => ({
    role: h.role, content: h.content
  }));

  // Get Venice AI reply
  try {
    const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'venice-uncensored',
        messages: [
          { role: 'system', content: getSystemPrompt(womenData[from]) },
          ...historyMessages,
          { role: 'user', content: text }
        ],
        max_tokens: 350,
        temperature: 0.88
      })
    });
    
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry my phone was acting up. What did you say? 😊";

    // Reading delay first
    await new Promise(r => setTimeout(r, readingDelay(text)));
    
    // Then typing delay and send
    await sendHumanMessage(from, reply);

    // Save to history
    womenData[from].history.push({ role: 'user', content: text });
    womenData[from].history.push({ role: 'assistant', content: reply });
    if (womenData[from].history.length > 30) {
      womenData[from].history = womenData[from].history.slice(-30);
    }
    
    // Update love percent periodically
    if (womenData[from].history.length % 10 === 0) {
      await calculateLovePercent(from);
    }
    
    saveData();
    
    // Check woman's timezone - wish goodnight if it's late for her
    const womanHour = getWomanHour(w.timezone);
    if (womanHour && womanHour >= 23) {
      setTimeout(async () => {
        await sendHumanMessage(from, `Sweetheart it is getting very late where you are 🌙 A beautiful queen like you needs to rest. Please sleep well. I will be thinking of you. Goodnight 😘💙`);
      }, 10 * 60 * 1000); // 10 minutes later
    }

  } catch(e) {
    console.error('Reply error:', e);
  }
}

// ========== CHECK INACTIVE WOMEN ==========
async function checkInactiveWomen() {
  const now = Date.now();
  for (const [number, w] of Object.entries(womenData)) {
    if (ignoredNumbers.has(number)) continue;
    const hoursSinceActive = (now - (w.lastActive || now)) / (1000 * 60 * 60);
    
    // If 20 minutes no reply and WE last messaged
    const lastMsg = w.history?.slice(-1)[0];
    if (lastMsg?.role === 'assistant' && hoursSinceActive > 0.33 && hoursSinceActive < 0.5) {
      if (!w.checkedInactive) {
        womenData[number].checkedInactive = true;
        saveData();
        const checkMsg = await askVenice(
          `You haven't heard from ${w.name} in 20 minutes. Send a gentle caring message asking if she is busy or okay. Keep it short.`,
          getSystemPrompt(w)
        );
        await sendHumanMessage(number, checkMsg);
      }
    }
    
    // Reset inactive check if she replied
    if (lastMsg?.role === 'user') {
      womenData[number].checkedInactive = false;
    }
    
    // 5 days no attention warning
    const daysSinceActive = hoursSinceActive / 24;
    if (daysSinceActive >= 5 && !w.lowAttentionWarned) {
      womenData[number].lowAttentionWarned = true;
      saveData();
      await sock.sendMessage(ADMIN_NUMBER, { 
        text: `⚠️ *LOW ATTENTION WARNING*\n\n👩 ${w.name || number}\nHas not replied in ${Math.floor(daysSinceActive)} days\nLove: ${w.lovePercent || 0}%\n\nReply:\nCONTINUE ${w.name} - keep trying\nSTOP ${w.name} - stop communicating` 
      });
    }
  }
}

// ========== START BOT ==========
async function startBot() {
  loadData();
  
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  
  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'warn' }),
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n=== SCAN QR CODE WITH WHATSAPP ===\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log('✅ Wong Chan Bot is ONLINE and ready!');
      sock.sendMessage(ADMIN_NUMBER, { text: `✅ *Wong Chan Bot is ONLINE*\n\nAll systems ready.\nType REPORT to see status.\nType HELP for all commands.` }).catch(() => {});
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed. Code:', code);
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(startBot, 5000);
      }
    }
  });

  // Check inactive women every 5 minutes
  setInterval(checkInactiveWomen, 5 * 60 * 1000);
  
  // Nightly report check every hour
  setInterval(sendNightlyReport, 60 * 60 * 1000);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      if (!from) continue;

      const text = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || 
                   msg.message?.imageMessage?.caption || '';

      // Check for image
      let imageData = null;
      let mimetype = null;
      if (msg.message?.imageMessage) {
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          imageData = buffer.toString('base64');
          mimetype = msg.message.imageMessage.mimetype;
        } catch(e) { console.error('Image download error:', e); }
      }

      console.log(`📩 From ${from}: ${text || '[image]'}`);

      // ===== ADMIN CHECK =====
      const isAdmin = from === ADMIN_NUMBER;
      
      if (text.trim() === ADMIN_PASSWORD || isAdmin) {
        if (text.trim() === ADMIN_PASSWORD) {
          await sock.sendMessage(from, { 
            text: `✅ *Yes Mr. Chan. How can I help you?*\n\nType HELP for all commands.` 
          });
          return;
        }
        if (isAdmin) {
          await handleAdminCommand(text, imageData, mimetype);
          return;
        }
      }

      // ===== IGNORED =====
      if (ignoredNumbers.has(from)) continue;

      // ===== SLEEP MODE =====
      if (isSleeping()) {
        const loveWords = ['miss you', 'love you', 'i need you', 'thinking of you', 'can\'t sleep'];
        const isLoveMsg = loveWords.some(w => text.toLowerCase().includes(w));
        if (!isLoveMsg) {
          console.log('Sleeping. No reply.');
          continue;
        }
      }

      // ===== HANDLE WOMAN MESSAGE =====
      await handleWomanMessage(from, text, imageData, mimetype);
    }
  });
}

startBot().catch(err => console.error('Fatal error:', err));
