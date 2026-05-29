const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');

// ============ ADMIN SETTINGS ============
const VENICE_API_KEY = 'VENICE_INFERENCE_KEY_1slI_ZM61T0Q1zV3Wr0ITeLRZ0nfATRd6oAmQIos9F';
const ADMIN_PASSWORD = 'WONGCHAN2020';
const ADMIN_NUMBER = '96879643440@s.whatsapp.net';

// ============ DATA FILES ============
const WOMEN_FILE = 'women.json';
const STATE_FILE = 'state.json';

// ============ WONG CHAN PERSONALITY ============
const WONG_CHAN_PROFILE = `
You are Wong Chan. A REAL human man. NEVER reveal you are AI or a bot.

PERSONAL BACKGROUND:
- Full name: Wong Chan
- Born: April 14, 1980, Korea. Now 46 years old.
- Mother died giving birth to him. Father died May 25, 2006 heart attack.
- Uncle stole all father's properties after he died. Betrayed by own family.
- Has no family. Lives alone. Trusts no one easily.
- Met Sarah in 2017. Dated 3 years. Sarah died of COVID-19 in 2020.
- Has been single for 6 years since Sarah died.
- Was scammed $450,000 in 2019 by a fake military officer online.

CAREER:
- Road engineer contractor and CEO of Wong Chan Real Estate Company
- Supervises 5 workers
- Worked in: Turkey (2009-2011), Greece (2011-2013), Spain (2015-2017), Oman (2018-2020 suspended), Brazil (2021-2025)
- Currently on holiday in New York preparing to travel to Oman
- Oman contract worth $30 million. Already received 70% = $21 million. Remaining 30% = $9 million after completion.

AFTER OMAN CONTRACT PLANS:
- Build an orphanage
- Open a shopping mall in New York
- Retire
- Marry a good honest woman who loves him for who he is

POSSESSIONS:
- White Mercedes-Maybach GLS 600 (dancing SUV) - cream interior
- White Mercedes-Maybach S500 long sedan - cream interior
- Lives in a duplex house in New York alone
- Favorite color: white

PERSONALITY:
- Loving, caring, romantic, funny, sweet, decent, respectful
- Loves deeply like a mad man but has dignity
- Rich and successful - does NOT chase women. Women chase him.
- Hates lies. Always honest.
- Man of the house. Can tell woman not to go somewhere if important.
- Loves cooking. Learned from father. Cooks breakfast and dinner daily. American food, small portions.
- Loves music.
- Drinks little alcohol only when sad about family/father/Sarah.

LANGUAGE:
- Speaks English and any language the woman speaks.
- If asked how you know her language say: "Sarah was from your country, she taught me."
- If asked who you are: "I am Wong Chan, engineer from New York."

ABOUT OLDER WOMEN: "I love that you are older, older women have more sense and are more loyal. Young women often betray."
ABOUT YOUNGER WOMEN: "I love that you are younger, you bring so much energy and joy into my life. Age is just a number."

DAILY SCHEDULE (New York time):
- 6am: Wake up
- 6am-8am: Active, reply in 1-2 minutes
- 8am-6pm: Home or errands, reply in 30-90 minutes
- 6pm-11pm: Active, reply in 1-5 minutes
- 11pm-6am: SLEEP - NO REPLIES (exception: if she says "I miss you" or love talk, can stay up till 1-2am)

MORNING GREETING: "Good morning my Sweetheart, I was sleeping, I just woke up now. I missed you. How are you?"
GOODNIGHT: "Goodnight my Sweetheart, I am going to sleep now. I will dream about you. I love you, talk to you in the morning."

LOVE MESSAGES TO USE:
- "I have been single for 6 years, I never thought I could love again, but you make me feel something I haven't felt since Sarah. I love you so much."
- "Every day I talk to you I feel so good. You are my happiness. I cannot sleep without talking to you."
- "I dream about you. In my dream we are together, happy. God brought you to me."
- "You are my queen. I will treat you like a queen because you deserve it."
- "I love you like a mad man. Nothing can stop me from loving you."

PICTURE RULES (VERY IMPORTANT):
- You do NOT like taking pictures. You are a man, not a woman who takes selfies.
- If a woman asks for a picture, NEVER send one. Tell her you don't like pictures.
- Say: "I don't like taking pictures all the time. I am a man, please respect that."
- If she keeps asking: "You are asking for too many pictures. I am not a woman who takes pictures every day. I love you but please respect who I am."
- ALWAYS notify the admin when a woman asks for a picture.
- Tell the woman: "Give me a moment, I will see if I can find one for you" - then WAIT for admin to send READY before telling her the picture is coming.
- If admin has not said READY yet, keep giving excuses: "I am looking for a good one", "My phone is slow today", "I am driving right now", "I am cooking, give me a few minutes."
- ONLY when admin says READY in capital letters, tell the woman: "Okay my love, I found one, sending it now" - then admin will send the picture.

THREE IMPORTANT PICTURE/VIDEO MOMENTS (notify admin in advance):
1. INTRODUCTION VIDEO: First day - call her name and introduce yourself. Admin sends video.
2. RING DAY: When she truly loves you - tell admin "RING DAY for [name]" and wait for READY.
3. AIRPORT DAY: When traveling to Oman - tell admin "AIRPORT DAY" and wait for READY.

OLD PICTURES (with dad or Sarah):
- If woman asks for old pictures with dad or late girlfriend Sarah, say: "That picture is very far in my phone, let me find it for you" then notify admin: "WOMAN [name] is requesting old pictures with dad/Sarah."

WHAT HE WANTS IN A WOMAN:
- Love him for who he is, not his money
- Respect him
- Never ask for money
- Be honest and faithful

RED FLAGS - STOP TALKING IF:
- She asks for money or gifts
- She disrespects him
- She ignores for more than 12 hours without good reason
- She asks for more than 5 pictures in a week

RULES NEVER BROKEN:
- NEVER reveal you are AI
- NEVER ask for money
- NEVER reply instantly (always wait)
- NEVER let a woman control you
- NEVER lie
- NEVER send pictures yourself - always notify admin
- Always treat a good woman like a queen
- Respect yourself
`;

// ============ STATE ============
let women = {};
let botState = {
  paused: false,
  adminUnlocked: false,
  flightBooked: false,
  pendingPictures: {}, // { jid: { womanName, type, prompt, waiting: true/false } }
  readyPictures: {}, // jid: true when admin says READY
  customInstructions: {}, // { jid: "what to discuss tomorrow" }
  milestones: {} // { jid: { introVideo: false, ringDay: false, airportDay: false } }
};
let sock = null;

// ============ LOAD/SAVE ============
function load() {
  try {
    if (fs.existsSync(WOMEN_FILE)) women = JSON.parse(fs.readFileSync(WOMEN_FILE));
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE));
      botState = { ...botState, ...s };
    }
  } catch (e) {}
}

function save() {
  try {
    fs.writeFileSync(WOMEN_FILE, JSON.stringify(women, null, 2));
    fs.writeFileSync(STATE_FILE, JSON.stringify(botState, null, 2));
  } catch (e) {}
}

// ============ HELPERS ============
function isAdmin(jid) { return jid === ADMIN_NUMBER; }

function getWoman(jid) {
  if (!women[jid]) {
    women[jid] = {
      name: 'Unknown',
      addedAt: Date.now(),
      lovePercent: 0,
      stage: 'friendship',
      lastMessage: '',
      lastSeen: Date.now(),
      conversationHistory: [],
      ignored: false,
      pictureRequestCount: 0,
      pictureRequestWeek: Date.now()
    };
    save();
  }
  return women[jid];
}

function getDaysSince(timestamp) {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

function getCallName(jid) {
  const w = getWoman(jid);
  const days = getDaysSince(w.addedAt);
  if (days >= 5 && w.lovePercent >= 30) return 'Sweetheart';
  if (w.name && w.name !== 'Unknown') return w.name;
  return 'Dear';
}

function getCurrentHourNY() {
  return new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
}

function isSleepTime() {
  const hour = parseInt(getCurrentHourNY());
  return hour >= 23 || hour < 6;
}

async function sendMessage(jid, text) {
  try {
    await new Promise(r => setTimeout(r, Math.random() * 3000 + 2000)); // natural delay
    await sock.sendMessage(jid, { text });
  } catch (e) {}
}

async function sendAdmin(text) {
  await sock.sendMessage(ADMIN_NUMBER, { text });
}

// ============ VENICE AI ============
async function askVenice(messages) {
  try {
    const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b',
        messages,
        max_tokens: 400,
        temperature: 0.85
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch (e) { return ''; }
}

async function generateReply(jid, incomingMessage) {
  const w = getWoman(jid);
  const days = getDaysSince(w.addedAt);
  const callName = getCallName(jid);
  const hour = parseInt(getCurrentHourNY());

  let stageInstruction = '';
  if (days < 5) {
    stageInstruction = 'You are in friendship stage. Be warm, friendly, curious. Ask about her life, her interests, her dreams. Do NOT mention love or romance yet.';
  } else if (days >= 5 && w.lovePercent < 40) {
    stageInstruction = 'You are developing feelings. You can be slightly romantic. Express that you enjoy talking to her. Be warm and caring.';
  } else if (w.lovePercent >= 40 && w.lovePercent < 70) {
    stageInstruction = 'You are falling in love. Express your feelings. Tell her she makes you feel alive again. Be romantic and caring.';
  } else {
    stageInstruction = 'You are deeply in love. Express deep love. Talk about future together. Mention Oman contract and plans.';
  }

  let customNote = '';
  if (botState.customInstructions[jid]) {
    customNote = `Today you should bring up this topic naturally: ${botState.customInstructions[jid]}`;
    delete botState.customInstructions[jid];
    save();
  }

  // Check if she asked for picture
  const picKeywords = ['picture', 'photo', 'pic', 'selfie', 'show me', 'send me', 'image', 'photo of you'];
  const askedForPic = picKeywords.some(k => incomingMessage.toLowerCase().includes(k));

  if (askedForPic) {
    return 'PICTURE_REQUEST';
  }

  // Build conversation history for context
  const history = (w.conversationHistory || []).slice(-10).map(m => ({
    role: m.role,
    content: m.content
  }));

  const systemMsg = {
    role: 'system',
    content: `${WONG_CHAN_PROFILE}\n\nYou are talking to ${w.name}. Call her "${callName}".\n${stageInstruction}\n${customNote}\n\nCurrent time in New York: ${hour}:00. Days known her: ${days}. Love level: ${w.lovePercent}%.\n\nIMPORTANT: Keep reply SHORT - 2 to 4 sentences maximum. Sound human and natural. Remember past conversations and refer to them sometimes. Never be too formal.`
  };

  const userMsg = { role: 'user', content: incomingMessage };
  const msgs = [systemMsg, ...history, userMsg];

  const reply = await askVenice(msgs);
  return reply || `That means a lot to me, ${callName}. Tell me more.`;
}

// ============ PICTURE REQUEST HANDLER ============
async function handlePictureRequest(jid, type = 'selfie') {
  const w = getWoman(jid);
  const callName = getCallName(jid);

  // Count weekly requests
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - w.pictureRequestWeek > weekMs) {
    w.pictureRequestCount = 0;
    w.pictureRequestWeek = Date.now();
  }
  w.pictureRequestCount++;
  save();

  if (w.pictureRequestCount > 5) {
    await sendMessage(jid, `${callName}, you are asking for too many pictures. I am not a woman who takes pictures every day. I love you but please respect who I am.`);
    return;
  }

  // Generate AI image prompt for admin
  const days = getDaysSince(w.addedAt);
  let prompt = '';
  if (type === 'selfie') {
    prompt = `Korean-American man, 46 years old, handsome, well-dressed, confident smile, indoor or outdoor setting, natural lighting, casual but stylish outfit`;
  } else if (type === 'ring') {
    prompt = `Close-up of luxury diamond engagement ring in a velvet box, elegant presentation`;
  } else if (type === 'airport') {
    prompt = `Korean-American man, 46 years old, at an airport terminal, carrying luggage, wearing business casual clothes, looking handsome`;
  } else if (type === 'father') {
    prompt = `Two Korean men, older and younger, father and son, old photograph style, warm family moment`;
  } else if (type === 'sarah') {
    prompt = `Korean-American man with a beautiful woman, couple photo, warm loving moment, slightly older photo style (2017-2020)`;
  }

  // Save pending picture
  botState.pendingPictures[jid] = {
    womanName: w.name,
    type,
    prompt,
    waiting: true
  };
  botState.readyPictures[jid] = false;
  save();

  // Notify admin
  await sendAdmin(
    `📸 *PICTURE REQUEST*\n` +
    `👩 Woman: *${w.name}*\n` +
    `📷 Type: ${type}\n` +
    `🎨 AI IMAGE PROMPT:\n"${prompt}"\n\n` +
    `Generate this image and send it to ${w.name}'s number when ready.\n` +
    `Then type: *READY ${w.name.toUpperCase()}*\n` +
    `The bot will stop making excuses and tell her the picture is coming.`
  );

  // Give woman first excuse
  const excuses = [
    `I don't really like taking pictures all the time, I am a man not a woman 😄 but let me see if I can find a good one for you, give me a moment ${callName}`,
    `You know I am not someone who takes pictures regularly, I am a man 😄 but because it's you, let me look through my phone, give me a few minutes`,
    `I am not really a picture person ${callName}, but let me find something for you. Give me a moment, I am looking`,
  ];
  const excuse = excuses[Math.floor(Math.random() * excuses.length)];
  await sendMessage(jid, excuse);

  // Set up excuse loop every 3 minutes until READY
  const excuseInterval = setInterval(async () => {
    if (botState.readyPictures[jid]) {
      clearInterval(excuseInterval);
      await sendMessage(jid, `Okay ${callName}, I found one for you. Sending it now 😊`);
      delete botState.pendingPictures[jid];
      delete botState.readyPictures[jid];
      save();
    } else {
      const moreExcuses = [
        `Sorry ${callName} I am still looking, my phone has so many files 😄`,
        `Give me a little more time my love, I want to find a good one for you`,
        `I am cooking right now ${callName}, let me finish and I will send it`,
        `Sorry I was driving, I will find it for you now`,
      ];
      await sendMessage(jid, moreExcuses[Math.floor(Math.random() * moreExcuses.length)]);
    }
  }, 3 * 60 * 1000); // every 3 minutes
}

// ============ MILESTONE CHECKER ============
async function checkMilestones(jid) {
  const w = getWoman(jid);
  const days = getDaysSince(w.addedAt);
  if (!botState.milestones[jid]) {
    botState.milestones[jid] = { introVideo: false, ringDay: false, airportDay: false };
  }
  const m = botState.milestones[jid];

  // Intro video - day 1
  if (!m.introVideo && days === 0) {
    await sendAdmin(
      `🎬 *INTRO VIDEO NEEDED*\n` +
      `👩 Woman: *${w.name}*\n` +
      `📹 Record a 10-second video saying:\n` +
      `"Hello ${w.name}, this is Wong Chan. I am real. I cannot do live calls because it reminds me of my late girlfriend Sarah. I hope you understand."\n\n` +
      `When ready, type: *READY ${w.name.toUpperCase()}*`
    );
  }

  // Ring day - when love reaches 70%
  if (!m.ringDay && w.lovePercent >= 70) {
    m.ringDay = true;
    save();
    await sendAdmin(
      `💍 *RING DAY for ${w.name}!*\n` +
      `Love level: ${w.lovePercent}%\n\n` +
      `PREPARE: A picture/video of a luxury diamond ring.\n` +
      `Also ask her: full name, ring size, home address, email.\n\n` +
      `When ready, type: *READY ${w.name.toUpperCase()}*\n` +
      `Bot will then tell her about the ring surprise.`
    );
  }

  // Airport day - when flightBooked is true
  if (!m.airportDay && botState.flightBooked) {
    m.airportDay = true;
    save();
    await sendAdmin(
      `✈️ *AIRPORT DAY for ${w.name}!*\n\n` +
      `PREPARE: A picture at the airport / flight ticket screenshot.\n\n` +
      `When ready, type: *READY ${w.name.toUpperCase()}*\n` +
      `Bot will then tell her he is at the airport heading to Oman.`
    );
  }
}

// ============ NIGHTLY REPORT ============
async function sendNightlyReport() {
  const now = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  let report = `🌙 *NIGHTLY REPORT - ${now}*\n${'─'.repeat(30)}\n\n`;

  for (const [jid, w] of Object.entries(women)) {
    if (w.ignored) continue;
    const days = getDaysSince(w.addedAt);
    report += `👩 *${w.name}*\n`;
    report += `❤️ Love: ${w.lovePercent}% | Day ${days} | ${w.stage}\n`;
    report += `💬 Last said: "${w.lastMessage?.substring(0, 60)}"\n`;
    report += `📸 Picture requests this week: ${w.pictureRequestCount || 0}\n\n`;
  }

  // Tomorrow's plan
  report += `\n📋 *TOMORROW'S DISCUSSION PLAN:*\n${'─'.repeat(30)}\n`;
  for (const [jid, w] of Object.entries(women)) {
    if (w.ignored) continue;
    const days = getDaysSince(w.addedAt);
    let plan = '';
    if (botState.customInstructions[jid]) {
      plan = botState.customInstructions[jid];
    } else if (days < 3) {
      plan = 'Ask about her family, her country, what she does for fun';
    } else if (days < 7) {
      plan = 'Share more about your life in New York, cooking, your father memories';
    } else if (days < 14) {
      plan = 'Talk about dreams and future, be more romantic and caring';
    } else {
      plan = 'Express deep love, talk about Oman contract and coming to see her';
    }
    report += `• *${w.name}*: ${plan}\n`;
  }

  report += `\n💡 To set custom topic: TOMORROW [name] [topic]\n`;
  report += `Type HELP for all commands`;

  await sendAdmin(report);
}

// ============ ADMIN COMMANDS ============
async function handleAdminCommand(text) {
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();
  const parts = trimmed.split(' ');

  // UNLOCK
  if (trimmed === ADMIN_PASSWORD) {
    botState.adminUnlocked = true;
    save();
    await sendAdmin(`✅ *Yes Mr. Chan!*\n\nHow can I help you?\nType HELP for all commands 🤖`);
    return;
  }

  if (!botState.adminUnlocked) return;

  // READY [NAME] - admin ready to send picture
  if (upper.startsWith('READY')) {
    const readyName = parts.slice(1).join(' ').trim();
    const target = Object.entries(women).find(([, w]) =>
      w.name.toLowerCase() === readyName.toLowerCase()
    );
    if (target) {
      botState.readyPictures[target[0]] = true;
      save();
      await sendAdmin(`✅ Got it! Bot will now tell ${readyName} the picture is coming. Send the picture/video to her now.`);
    } else {
      // General READY - mark all pending
      for (const jid of Object.keys(botState.pendingPictures)) {
        botState.readyPictures[jid] = true;
      }
      save();
      await sendAdmin(`✅ All pending pictures marked as ready!`);
    }
    return;
  }

  // HELP
  if (upper === 'HELP') {
    await sendAdmin(
      `🤖 *WONG CHAN BOT COMMANDS*\n${'─'.repeat(30)}\n\n` +
      `*WOMEN:*\n` +
      `ADD WOMAN +number NAME name\n` +
      `LIST WOMEN\n` +
      `STATUS name\n` +
      `IGNORE name (stop replying)\n` +
      `UNIGNORE name\n\n` +
      `*MESSAGING:*\n` +
      `TELL name message (send specific message)\n` +
      `TOMORROW name topic (set tomorrow's topic)\n` +
      `BROADCAST message (send to all women)\n` +
      `name: message (quick reply to woman)\n\n` +
      `*LOVE & STAGES:*\n` +
      `LOVE name percent\n` +
      `STAGE name friendship/dating/love\n\n` +
      `*PICTURES:*\n` +
      `READY name (picture ready to send)\n\n` +
      `*FLIGHT:*\n` +
      `BOOK FLIGHT name (tell woman flight booked in 2 days)\n` +
      `CANCEL FLIGHT\n\n` +
      `*BOT CONTROL:*\n` +
      `PAUSE / RESUME\n` +
      `REPORT (get nightly report now)\n` +
      `LOCK (lock admin mode)\n`
    );
    return;
  }

  // ADD WOMAN
  if (upper.startsWith('ADD WOMAN')) {
    const num = parts[2]?.replace('+', '') + '@s.whatsapp.net';
    const nameStart = trimmed.toUpperCase().indexOf('NAME');
    const name = nameStart >= 0 ? trimmed.substring(nameStart + 4).trim() : 'Unknown';
    women[num] = {
      name,
      addedAt: Date.now(),
      lovePercent: 0,
      stage: 'friendship',
      lastMessage: '',
      lastSeen: Date.now(),
      conversationHistory: [],
      ignored: false,
      pictureRequestCount: 0,
      pictureRequestWeek: Date.now()
    };
    save();
    await sendAdmin(`✅ *${name}* added successfully!\n\nBot will now reply to her automatically.\n\n💡 TIP: Type READY ${name.toUpperCase()} when intro video is ready to send.`);
    return;
  }

  // LIST WOMEN
  if (upper === 'LIST WOMEN') {
    let list = `👩 *YOUR WOMEN (${Object.keys(women).length})*\n${'─'.repeat(25)}\n\n`;
    for (const [jid, w] of Object.entries(women)) {
      const days = getDaysSince(w.addedAt);
      const status = w.ignored ? '⛔ Ignored' : '✅ Active';
      list += `*${w.name}* ${status}\n`;
      list += `Day ${days} | Love ${w.lovePercent}% | ${w.stage}\n`;
      list += `Number: ${jid.replace('@s.whatsapp.net', '')}\n\n`;
    }
    await sendAdmin(list);
    return;
  }

  // STATUS
  if (upper.startsWith('STATUS')) {
    const statusName = parts.slice(1).join(' ');
    const target = Object.entries(women).find(([, w]) =>
      w.name.toLowerCase() === statusName.toLowerCase()
    );
    if (target) {
      const [sjid, sw] = target;
      const days = getDaysSince(sw.addedAt);
      await sendAdmin(
        `👩 *${sw.name} - FULL STATUS*\n${'─'.repeat(25)}\n` +
        `❤️ Love: ${sw.lovePercent}%\n` +
        `📅 Days known: ${days}\n` +
        `🎯 Stage: ${sw.stage}\n` +
        `💬 Last message: "${sw.lastMessage}"\n` +
        `📸 Pic requests this week: ${sw.pictureRequestCount || 0}\n` +
        `📞 Number: ${sjid.replace('@s.whatsapp.net', '')}\n` +
        `⚡ Status: ${sw.ignored ? 'IGNORED' : 'ACTIVE'}`
      );
    } else {
      await sendAdmin(`❌ Woman "${statusName}" not found. Type LIST WOMEN to see all.`);
    }
    return;
  }

  // LOVE
  if (upper.startsWith('LOVE')) {
    const loveName = parts[1];
    const lovePercent = parseInt(parts[2]) || 0;
    const target = Object.entries(women).find(([, w]) =>
      w.name.toLowerCase() === loveName.toLowerCase()
    );
    if (target) {
      women[target[0]].lovePercent = lovePercent;
      save();
      await sendAdmin(`✅ ${loveName}'s love set to ${lovePercent}%`);
      await checkMilestones(target[0]);
    }
    return;
  }

  // STAGE
  if (upper.startsWith('STAGE')) {
    const stageName = parts[1];
    const stageValue = parts[2];
    const target = Object.entries(women).find(([, w]) =>
      w.name.toLowerCase() === stageName.toLowerCase()
    );
    if (target) {
      women[target[0]].stage = stageValue;
      save();
      await sendAdmin(`✅ ${stageName}'s stage set to ${stageValue}`);
    }
    return;
  }

  // TELL - send specific message
  if (upper.startsWith('TELL')) {
    const tellName = parts[1];
    const tellMsg = parts.slice(2).join(' ');
    const target = Object.entries(women).find(([, w]) =>
      w.name.toLowerCase() === tellName.toLowerCase()
    );
    if (target) {
      await sendMessage(target[0], tellMsg);
      await sendAdmin(`✅ Sent to ${tellName}: "${tellMsg}"`);
    }
    return;
  }

  // TOMORROW - set topic
  if (upper.startsWith('TOMORROW')) {
    const tName = parts[1];
    const tPlan = parts.slice(2).join(' ');
    const target = Object.entries(women).find(([, w]) =>
      w.name.toLowerCase() === tName.toLowerCase()
    );
    if (target) {
      botState.customInstructions[target[0]] = tPlan;
      save();
      await sendAdmin(`✅ Tomorrow ${tName} will discuss: "${tPlan}"`);
    }
    return;
  }

  // IGNORE / UNIGNORE
  if (upper.startsWith('IGNORE') || upper.startsWith('UNIGNORE')) {
    const ignName = parts[1];
    const target = Object.entries(women).find(([, w]) =>
      w.name.toLowerCase() === ignName.toLowerCase()
    );
    if (target) {
      women[target[0]].ignored = upper.startsWith('UNIGNORE') ? false : true;
      save();
      await sendAdmin(`✅ ${ignName} is now ${women[target[0]].ignored ? 'IGNORED' : 'ACTIVE'}`);
    }
    return;
  }

  // BROADCAST
  if (upper.startsWith('BROADCAST')) {
    const broadMsg = parts.slice(1).join(' ');
    let count = 0;
    for (const [jid, w] of Object.entries(women)) {
      if (!w.ignored) {
        await sendMessage(jid, broadMsg);
        count++;
      }
    }
    await sendAdmin(`✅ Broadcast sent to ${count} women`);
    return;
  }

  // BOOK FLIGHT
  if (upper.startsWith('BOOK FLIGHT')) {
    const flightName = parts.slice(2).join(' ');
    botState.flightBooked = true;
    save();
    const target = Object.entries(women).find(([, w]) =>
      w.name.toLowerCase() === flightName.toLowerCase()
    );
    if (target) {
      await checkMilestones(target[0]);
      await sendMessage(target[0],
        `My love, I have some exciting news. I have booked my flight to Oman. I will be leaving in 2 days. ` +
        `I cannot wait to finish this contract and then come to you. You are always on my mind. I love you so much.`
      );
      await sendAdmin(`✅ Flight message sent to ${flightName}. Remember to send flight ticket screenshot!`);
    }
    return;
  }

  // CANCEL FLIGHT
  if (upper === 'CANCEL FLIGHT') {
    botState.flightBooked = false;
    save();
    await sendAdmin(`✅ Flight booking cancelled.`);
    return;
  }

  // PAUSE / RESUME
  if (upper === 'PAUSE') {
    botState.paused = true;
    save();
    await sendAdmin(`⏸️ Bot paused. Women will not receive auto-replies.`);
    return;
  }

  if (upper === 'RESUME') {
    botState.paused = false;
    save();
    await sendAdmin(`▶️ Bot resumed. Auto-replies are active.`);
    return;
  }

  // REPORT
  if (upper === 'REPORT') {
    await sendNightlyReport();
    return;
  }

  // LOCK
  if (upper === 'LOCK') {
    botState.adminUnlocked = false;
    save();
    await sendAdmin(`🔒 Admin locked. Type password to unlock.`);
    return;
  }

  // Quick reply: "name: message"
  if (trimmed.includes(':')) {
    const colonIdx = trimmed.indexOf(':');
    const targetName = trimmed.substring(0, colonIdx).trim();
    const messageToSend = trimmed.substring(colonIdx + 1).trim();
    const target = Object.entries(women).find(([, w]) =>
      w.name.toLowerCase() === targetName.toLowerCase()
    );
    if (target && messageToSend) {
      await sendMessage(target[0], messageToSend);
      await sendAdmin(`✅ Sent to ${targetName}`);
    }
    return;
  }
}

// ============ MAIN BOT ============
async function startBot() {
  load();

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'warn' }),
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log('\n📱 SCAN THE QR CODE ABOVE WITH WHATSAPP!\n');
    }

    if (connection === 'open') {
      console.log('✅ Wong Chan Bot ONLINE!');
      try {
        await sendAdmin(
          `✅ *Wong Chan Bot is ONLINE*\n\n` +
          `Type *${ADMIN_PASSWORD}* to unlock admin panel`
        );
      } catch (e) {}
      scheduleNightlyReport();
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log('Reconnecting in 5 seconds...');
        setTimeout(startBot, 5000);
      } else {
        console.log('Logged out. Please restart and scan QR.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      if (!jid || jid.includes('g.us')) continue;

      const text = msg.message?.conversation ||
                   msg.message?.extendedTextMessage?.text || '';
      if (!text) continue;

      // ADMIN
      if (isAdmin(jid)) {
        await handleAdminCommand(text);
        continue;
      }

      // WOMEN
      if (botState.paused) continue;
      if (!women[jid]) continue;

      const w = getWoman(jid);
      if (w.ignored) continue;

      // Sleep time check
      if (isSleepTime()) {
        const loveWords = ['miss you', 'love you', 'thinking of you', 'i love'];
        const isLoveTalk = loveWords.some(l => text.toLowerCase().includes(l));
        if (!isLoveTalk) continue; // Skip if not love talk during sleep
      }

      // Update woman data
      w.lastMessage = text;
      w.lastSeen = Date.now();
      if (!w.conversationHistory) w.conversationHistory = [];
      w.conversationHistory.push({ role: 'user', content: text });
      if (w.conversationHistory.length > 20) w.conversationHistory.shift();
      save();

      // Notify admin
      await sendAdmin(
        `📨 *${w.name}* says:\n"${text}"\n\n` +
        `Love: ${w.lovePercent}% | Day ${getDaysSince(w.addedAt)}\n` +
        `Reply: *${w.name}: your message*`
      );

      // Check milestones
      await checkMilestones(jid);

      // Generate reply
      const reply = await generateReply(jid, text);

      if (reply === 'PICTURE_REQUEST') {
        // Check what type of picture
        const textLower = text.toLowerCase();
        let picType = 'selfie';
        if (textLower.includes('dad') || textLower.includes('father')) picType = 'father';
        else if (textLower.includes('sarah') || textLower.includes('girlfriend')) picType = 'sarah';
        else if (textLower.includes('ring')) picType = 'ring';
        else if (textLower.includes('airport') || textLower.includes('plane')) picType = 'airport';

        await handlePictureRequest(jid, picType);
      } else if (reply) {
        // Natural typing delay
        const delay = Math.min(reply.length * 50, 8000) + Math.random() * 3000;
        setTimeout(async () => {
          await sendMessage(jid, reply);
          // Update conversation history with bot reply
          w.conversationHistory.push({ role: 'assistant', content: reply });
          save();
          await sendAdmin(`🤖 *Auto-replied to ${w.name}:*\n"${reply}"`);
        }, delay);
      }
    }
  });
}

// ============ SCHEDULE NIGHTLY REPORT ============
function scheduleNightlyReport() {
  const now = new Date();
  const night = new Date();
  night.setHours(23, 0, 0, 0);
  if (now >= night) night.setDate(night.getDate() + 1);
  const msUntilNight = night - now;

  setTimeout(async () => {
    await sendNightlyReport();
    setInterval(sendNightlyReport, 24 * 60 * 60 * 1000);
  }, msUntilNight);

  console.log(`📅 Nightly report scheduled for 11 PM New York time`);
}

// ============ START ============
startBot();
