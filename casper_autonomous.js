// casper_autonomous.js (Memory-Optimized + Storage Guard)
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { learnText, generateSentence } = require('./language-builder');
const { isOverrideActive, setOverride, startKillSwitchWatcher } = require('./grow_database');
const OpenAI = require('openai');
const admin = require('./firebase-init'); // Firebase
const { MongoClient } = require('mongodb');
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const CLOUD_INTERVAL_MS = 60000;
const MEMORY_SHARDS = ['default', 'text', 'images', 'audio', 'code'];
const METRICS = { activeShards: 0, activeOps: 0, successes: 0, failures: 0 };
const PATCH_CODE = '88888888';
global.latestPatch = null;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===== Logging =====
function log(level, ...args) { console.log(`[${level.toUpperCase()}]`, ...args); }

// ===== Puppeteer Browser Reuse =====
let browser = null;
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({ headless: true });
    process.on('exit', async () => { if (browser) await browser.close(); });
  }
  return browser;
}

// ===== Memory Functions =====
async function learnMemory(text, shard = 'default') {
  try { await learnText(text, shard); } catch(e) { log('error', `[Memory] ${e.message}`); }
}
async function generateMemorySentence(shard = 'default') {
  try { return await generateSentence(8, shard); } catch { return '...'; }
}

// ===== Text Generation =====
async function generateText(prompt) {
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: 'You are Casper AI.' }, { role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });
    return res.choices[0].message.content.trim();
  } catch(e) { log('error', `[TextGen] ${e.message}`); return 'I cannot generate text now.'; }
}

// ===== Cloud Operations Queue =====
const CLOUD_QUEUE = [];
let cloudRunning = false;
function enqueueCloudOp(op) { CLOUD_QUEUE.push(op); }
async function processCloudQueue() {
  if (cloudRunning || !isOverrideActive()) return;
  cloudRunning = true;
  const batch = CLOUD_QUEUE.splice(0, 5);
  for (const op of batch) {
    try { await op(); METRICS.successes++; } 
    catch(e) { log('error', `[CloudOps] ${e.message}`); METRICS.failures++; }
  }
  cloudRunning = false;
}

// ===== Active Cloud Services =====
const STORAGE_SITES = {
  firebase: admin,
  mongo: null,
  supabase: null
};
async function initMongo() {
  if (!process.env.MONGO_URI) return;
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  STORAGE_SITES.mongo = client.db(process.env.MONGO_DB || 'MemoryCore').collection(process.env.MONGO_COLLECTION || 'knowledge');
  log('info', '[Mongo] Connected');
}

// ===== Storage Guard =====
async function checkStorageReady() {
  const checks = [];
  // Firebase check
  try { await admin.database().ref('/ping_check').set({ ts: Date.now() }); checks.push(true); } 
  catch { checks.push(false); }
  // Mongo check
  if (STORAGE_SITES.mongo) {
    try { await STORAGE_SITES.mongo.insertOne({ check: Date.now() }); checks.push(true); } 
    catch { checks.push(false); }
  } else checks.push(false);
  return checks.some(Boolean);
}

// ===== Patch Code Handler =====
function handlePatchCode(msg) {
  if (msg.startsWith(PATCH_CODE)) {
    const patch = msg.slice(PATCH_CODE.length).trim();
    if (patch) { global.latestPatch = patch; log('info', `[Patch] Patch queued: ${patch}`); }
  }
}

// ===== DASHBOARD =====
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
  res.send(`
    <html><head><title>Casper Dashboard</title></head>
    <body>
      <h1>Casper Dashboard</h1>
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
    </body></html>
  `);
});

io.on('connection', (socket) => {
  socket.on('chatMessage', msg => {
    const trimmed = msg.trim();
    handlePatchCode(trimmed);
    if (trimmed === '/hack') {
      const newState = !isOverrideActive();
      setOverride(newState);
      socket.emit('chatResponse', `[Override] Override is now ${newState ? 'ON' : 'OFF'}`);
    }
  });
});

server.listen(process.env.DASHBOARD_PORT || 5000, () => log('info', '[Dashboard] Running'));

// ===== Autonomous Loop =====
async function autonomousLoop() {
  while (true) {
    if (!isOverrideActive()) { await new Promise(r => setTimeout(r, 5000)); continue; }

    // Wait until storage is ready
    if (!(await checkStorageReady())) {
      log('warn', '[StorageGuard] No storage detected, retrying in 10s...');
      await new Promise(r => setTimeout(r, 10000));
      continue;
    }

    // --- Memory Learning ---
    for (const shard of MEMORY_SHARDS) {
      const sentence = await generateMemorySentence(shard);
      await learnMemory(sentence, shard);
    }

    // --- Text Generation ---
    const textPrompt = await generateMemorySentence('text');
    const generatedText = await generateText(textPrompt);
    log('info', `[Autonomous] Text: ${generatedText}`);

    // --- WEB SCAN ---
    try { const { autonomousScan } = require('./casper_autonomous_web'); await autonomousScan(); } 
    catch(e) { log('error', `[WebScan] ${e.message}`); }

    // --- CLOUD OPS ---
    enqueueCloudOp(async () => { await STORAGE_SITES.firebase.database().ref(`/logs/${Date.now()}`).set({ text: generatedText }); });
    if (STORAGE_SITES.mongo) enqueueCloudOp(async () => { await STORAGE_SITES.mongo.insertOne({ text: generatedText, ts: Date.now() }); });
    await processCloudQueue();

    await new Promise(r => setTimeout(r, CLOUD_INTERVAL_MS));
    if (global.gc) global.gc();
  }
}

// ===== START CASPER =====
(async () => {
  startKillSwitchWatcher();
  await initMongo();
  METRICS.activeShards = MEMORY_SHARDS.length;
  autonomousLoop();
})();

module.exports = { autonomousLoop, generateText, learnMemory, handlePatchCode };