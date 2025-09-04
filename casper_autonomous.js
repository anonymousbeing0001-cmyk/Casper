// casper_autonomous.js
// ===== Casper Autonomous System =====
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const puppeteer = require('puppeteer');
const { learnText, generateSentence } = require('./language-builder');
const { autoProvisionAll, getProviders } = require('./autoprovision');
const admin = require('./firebase-init');
const { google } = require('googleapis');
const Dropbox = require('dropbox').Dropbox;
const OpenAI = require('openai');
const { isOverrideActive, setOverride, startKillSwitchWatcher } = require('./grow_database');

// ===== CONFIG =====
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 5000;
const HEADLESS = process.env.HEADLESS === 'true';
const CLOUD_INTERVAL_MS = 60000; // 1 minute loop
const MEMORY_SHARDS = ['default', 'text', 'images', 'audio', 'code'];
const METRICS = { activeShards: 0, activeOps: 0, successes: 0, failures: 0 };
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PATCH_CODE = '88888888';

global.latestPatch = null;

// ===== LOGGING & METRICS =====
function log(level, ...args) { console.log(`[${level.toUpperCase()}]`, ...args); }
function updateMetrics() { io.emit('metrics', METRICS); }

// ===== DASHBOARD =====
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ===== CHAT PATCH LISTENER =====
io.on('connection', (socket) => {
  console.log('[Chat] New connection established.');

  socket.on('chatMessage', async (msg) => {
    const trimmed = msg.trim();

    // PATCH CODE
    if (trimmed.startsWith(PATCH_CODE)) {
      const patchCode = trimmed.slice(PATCH_CODE.length).trim();
      if (patchCode.length === 0) {
        socket.emit('chatResponse', '[Patch] No patch code provided.');
        return;
      }
      console.log('[Patch] Patch code received via chat.');
      global.latestPatch = patchCode;
      socket.emit('chatResponse', '[Patch] Patch queued for application.');
    }

    // OVERRIDE FLIP
    if (trimmed === '/hack') {
      const newState = !isOverrideActive();
      setOverride(newState);  
      socket.emit('chatResponse', `[Override] Override is now ${newState ? 'ON' : 'OFF'}.`);
      console.log(`[Override] Override flipped to ${newState}`);
    }
  });
});

app.get('/', (req, res) => {
  res.send(`
    <html><head><title>Casper Dashboard</title></head>
    <body>
      <h1>Casper Autonomous Dashboard</h1>
      <ul>
        <li>Active Shards: <span id="activeShards">0</span></li>
        <li>Active Ops: <span id="activeOps">0</span></li>
        <li>Successes: <span id="successes">0</span></li>
        <li>Failures: <span id="failures">0</span></li>
      </ul>
      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        socket.on('metrics', data => {
          document.getElementById('activeShards').textContent = data.activeShards;
          document.getElementById('activeOps').textContent = data.activeOps;
          document.getElementById('successes').textContent = data.successes;
          document.getElementById('failures').textContent = data.failures;
        });
      </script>
    </body>
    </html>
  `);
});

server.listen(DASHBOARD_PORT, () => log('info', `[Dashboard] Running at http://localhost:${DASHBOARD_PORT}`));

// ===== MEMORY & SEMANTIC SHARDS =====
async function learnMemory(text, shard = 'default') {
  try { await learnText(text, shard); } 
  catch(e) { log('error', `[Memory] Failed to learn shard ${shard}:`, e.message); }
}

async function generateMemorySentence(shard = 'default') {
  try { return await generateSentence(8, shard); } 
  catch { return '...'; }
}

// ===== MULTI-MODAL AI =====
async function generateText(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: 'You are Casper AI.' }, { role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });
    return response.choices[0].message.content.trim();
  } catch (e) {
    log('error', `[Text Generation] Failed: ${e.message}`);
    return 'I cannot generate text right now.';
  }
}

async function generateImage(prompt) {
  try {
    const res = await openai.images.generate({ 
      model: 'dall-e-2', 
      prompt, 
      size: '512x512' 
    });
    return res.data[0].url;
  } catch (e) {
    log('error', `[Image Generation] Failed: ${e.message}`);
    return null;
  }
}

async function generateAudio(text) {
  try {
    const res = await openai.audio.speech.create({ 
      model: 'tts-1', 
      voice: 'alloy', 
      input: text 
    });
    const audioPath = path.join(__dirname, `audio_${Date.now()}.mp3`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(audioPath, buffer);
    return audioPath;
  } catch (e) {
    log('error', `[Audio Generation] Failed: ${e.message}`);
    return null;
  }
}

async function generateCode(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: 'You are Casper AI, writing code snippets.' }, { role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 200
    });
    return response.choices[0].message.content.trim();
  } catch (e) {
    log('error', `[Code Generation] Failed: ${e.message}`);
    return '// Unable to generate code';
  }
}

// ===== CLOUD OPERATIONS =====
const STORAGE_SITES = [
  { name: "Google Drive", type: "cloud", auth: null },
  { name: "Dropbox", type: "cloud", token: null },
  { name: "MongoDB Atlas", type: "nosql", uri: null },
  { name: "Supabase", type: "postgres", apiKey: null },
  { name: "Firebase Realtime DB", type: "nosql" }
];

async function performCloudOps(accountEmail) {
  if (!isOverrideActive()) {
    log('warn', '[CloudOps] Override OFF - operations disabled');
    return;
  }
  
  METRICS.activeOps++; 
  updateMetrics();

  for (const site of STORAGE_SITES) {
    try {
      switch(site.name) {
        case 'Google Drive':
          if (!site.auth) break;
          const drive = google.drive({ version: 'v3', auth: site.auth });
          await drive.files.create({ 
            requestBody: { name: `Casper_${Date.now()}.json`, mimeType: 'application/json' }, 
            media: { mimeType: 'application/json', body: JSON.stringify({ email: accountEmail, ts: new Date() }) } 
          });
          break;
        case 'Dropbox':
          if (!site.token) break;
          const dbx = new Dropbox({ accessToken: site.token, fetch });
          await dbx.filesUpload({ 
            path: `/Casper_${Date.now()}.json`, 
            contents: JSON.stringify({ email: accountEmail, ts: new Date() }) 
          });
          break;
        case 'MongoDB Atlas':
          const { vocabCol } = getProviders().mongodb || {};
          if (vocabCol) await vocabCol.insertOne({ email: accountEmail, ts: Date.now() });
          break;
        default: 
          break;
      }
      METRICS.successes++; 
      updateMetrics();
    } catch(e) {
      log('error', `[CloudOps] ${site.name}: ${e.message}`);
      METRICS.failures++; 
      updateMetrics();
    }
  }

  METRICS.activeOps--; 
  updateMetrics();
}

// ===== AUTONOMOUS LOOP =====
async function autonomousLoop() {
  const accounts = [{ email: 'casper@ai.com' }];

  while (true) {
    if (!isOverrideActive()) { 
      await new Promise(r => setTimeout(r, 5000)); 
      continue; 
    }

    // --- MEMORY LEARNING ---
    for (const shard of MEMORY_SHARDS) {
      const sentence = await generateMemorySentence(shard);
      await learnMemory(sentence, shard);
    }

    // --- MULTI-MODAL GENERATION ---
    const textPrompt = await generateMemorySentence('text');
    const generatedText = await generateText(textPrompt);
    const imageUrl = await generateImage(generatedText);
    const audioFile = await generateAudio(generatedText);
    const codeSnippet = await generateCode(generatedText);

    log('info', `[Autonomous] Text: ${generatedText}`);
    if (imageUrl) log('info', `[Autonomous] Image: ${imageUrl}`);
    if (audioFile) log('info', `[Autonomous] Audio file: ${audioFile}`);
    log('info', `[Autonomous] Code snippet:\n${codeSnippet}`);

    // --- WEB SCAN ---
    try {
      const { autonomousScan } = require('./casper_autonomous_web');
      await autonomousScan();
    } catch (e) {
      log('error', '[WebScan]', e.message);
    }

    // --- CLOUD OPERATIONS ---
    for (const account of accounts) await performCloudOps(account.email);

    // Pause loop before next iteration
    await new Promise(r => setTimeout(r, CLOUD_INTERVAL_MS));
  }
}

// ===== START CASPER =====
(async () => {
  startKillSwitchWatcher();
  await autoProvisionAll();
  METRICS.activeShards = MEMORY_SHARDS.length; 
  updateMetrics();
  autonomousLoop();
})();