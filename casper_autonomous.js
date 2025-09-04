// casper_autonomous.js (Memory-Optimized + Patch + Queued Cloud Ops)
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { learnText, generateSentence } = require('./language-builder');
const OpenAI = require('openai');
const { isOverrideActive, setOverride, startKillSwitchWatcher } = require('./grow_database');
const { performCloudOps } = require('./casper_real_operations');

const CLOUD_INTERVAL_MS = 60000; // 1 minute
const MEMORY_SHARDS = ['default', 'text', 'images', 'audio', 'code'];
const METRICS = { activeShards: 0, activeOps: 0, successes: 0, failures: 0 };
const HEAP_LIMIT = 1.6 * 1024 * 1024 * 1024; // 1.6 GB threshold
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PATCH_CODE = '88888888';

global.latestPatch = null;

function log(level, ...args) { console.log(`[${level.toUpperCase()}]`, ...args); }

// ===== Reusable Puppeteer Browser =====
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
  try { await learnText(text, shard); } catch(e) { log('error', e.message); }
}

async function generateMemorySentence(shard = 'default') {
  try { return await generateSentence(8, shard); } catch { return '...'; }
}

// ===== Text Generation =====
async function generateText(prompt) {
  if (process.memoryUsage().heapUsed > HEAP_LIMIT) return 'Memory high, skipping generation';
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: 'You are Casper AI.' }, { role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });
    return res.choices[0].message.content.trim();
  } catch(e) { log('error', e.message); return 'I cannot generate text now.'; }
}

// ===== Queued Cloud Operations =====
const cloudQueue = [];
async function queueCloudOp(accountEmail) {
  cloudQueue.push(accountEmail);
}

async function processCloudQueue() {
  if (!cloudQueue.length || !isOverrideActive()) return;
  const batch = cloudQueue.splice(0, 2); // process max 2 per iteration
  for (const email of batch) {
    await performCloudOps(email);
  }
}

// ===== Autonomous Web Scan =====
async function performWebScan() {
  try {
    const { autonomousScan } = require('./casper_autonomous_web');
    await autonomousScan();
  } catch(e) { log('error', '[WebScan]', e.message); }
}

// ===== Patch Handling =====
function handlePatch(msg) {
  const trimmed = msg.trim();
  if (!trimmed.startsWith(PATCH_CODE)) return false;
  const patch = trimmed.slice(PATCH_CODE.length).trim();
  if (patch.length === 0) return true;
  global.latestPatch = patch;
  log('info', '[Patch] Queued for application');
  return true;
}

// ===== Autonomous Loop =====
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
    log('info', `[Autonomous] Text: ${generatedText}`);

    // --- Queue Cloud Ops ---
    for (const account of accounts) await queueCloudOp(account.email);
    await processCloudQueue();

    // --- WEB SCAN ---
    await performWebScan();

    // --- Pause Loop ---
    await new Promise(r => setTimeout(r, CLOUD_INTERVAL_MS));

    // Force GC if exposed
    if (global.gc) global.gc();
  }
}

// ===== START DASHBOARD & LISTENERS =====
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', socket => {
  log('info', '[Chat] New connection');
  
  socket.on('chatMessage', async msg => {
    if (handlePatch(msg)) {
      socket.emit('chatResponse', '[Patch] Patch received.');
      return;
    }

    if (msg.trim() === '/hack') {
      const newState = !isOverrideActive();
      setOverride(newState);
      socket.emit('chatResponse', `[Override] Override is now ${newState ? 'ON' : 'OFF'}.`);
      log('info', `[Override] Override flipped to ${newState}`);
    }
  });
});

app.get('/', (req, res) => res.send('<h1>Casper AI Dashboard</h1>'));
server.listen(process.env.DASHBOARD_PORT || 5000, () => log('info', '[Dashboard] Running'));

// ===== START CASPER =====
(async () => {
  startKillSwitchWatcher();
  METRICS.activeShards = MEMORY_SHARDS.length;
  autonomousLoop();
})();