// casper_autonomous.js (Memory-Optimized, Full Features)
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { learnText, generateSentence } = require('./language-builder');
const { isOverrideActive, setOverride, startKillSwitchWatcher } = require('./grow_database');
const OpenAI = require('openai');
const admin = require('./firebase-init'); // Firebase
const { MongoClient } = require('mongodb');
require('dotenv').config();

const CLOUD_INTERVAL_MS = 60000; // 1 minute
const MEMORY_SHARDS = ['default', 'text', 'images', 'audio', 'code'];
const METRICS = { activeShards: 0, activeOps: 0, successes: 0, failures: 0 };
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PATCH_CODE = '88888888';

global.latestPatch = null;

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

// Add operation to queue
function enqueueCloudOp(op) { CLOUD_QUEUE.push(op); }

// Run queued cloud operations (batched)
async function processCloudQueue() {
  if (cloudRunning || !isOverrideActive()) return;
  cloudRunning = true;
  const batch = CLOUD_QUEUE.splice(0, 5); // process max 5 at a time
  for (const op of batch) {
    try { await op(); METRICS.successes++; } 
    catch(e) { log('error', `[CloudOps] ${e.message}`); METRICS.failures++; }
  }
  cloudRunning = false;
}

// ===== Active Cloud Services =====
const STORAGE_SITES = {
  firebase: admin, // configured
  mongo: null,     // will initialize below
  supabase: null   // placeholder
};

// Mongo Initialization
async function initMongo() {
  if (!process.env.MONGO_URI) return;
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  STORAGE_SITES.mongo = client.db(process.env.MONGO_DB || 'MemoryCore').collection(process.env.MONGO_COLLECTION || 'knowledge');
  log('info', '[Mongo] Connected');
}

// ===== Patch Code Listener =====
function handlePatchCode(msg) {
  if (msg.startsWith(PATCH_CODE)) {
    const patch = msg.slice(PATCH_CODE.length).trim();
    if (patch) {
      global.latestPatch = patch;
      log('info', `[Patch] Patch queued: ${patch}`);
    }
  }
}

// ===== Autonomous Loop =====
async function autonomousLoop() {
  while (true) {
    if (!isOverrideActive()) { await new Promise(r => setTimeout(r, 5000)); continue; }

    // --- MEMORY LEARNING ---
    for (const shard of MEMORY_SHARDS) {
      const sentence = await generateMemorySentence(shard);
      await learnMemory(sentence, shard);
    }

    // --- TEXT GENERATION ---
    const textPrompt = await generateMemorySentence('text');
    const generatedText = await generateText(textPrompt);
    log('info', `[Autonomous] Text: ${generatedText}`);

    // --- WEB SCAN (reuse browser) ---
    try {
      const { autonomousScan } = require('./casper_autonomous_web');
      await autonomousScan();
    } catch(e) { log('error', `[WebScan] ${e.message}`); }

    // --- CLOUD OPERATIONS (batched) ---
    // Firebase write
    enqueueCloudOp(async () => {
      await STORAGE_SITES.firebase.database().ref(`/logs/${Date.now()}`).set({ text: generatedText });
    });
    // Mongo write
    if (STORAGE_SITES.mongo) {
      enqueueCloudOp(async () => {
        await STORAGE_SITES.mongo.insertOne({ text: generatedText, ts: Date.now() });
      });
    }

    // Process queued cloud operations
    await processCloudQueue();

    // Pause
    await new Promise(r => setTimeout(r, CLOUD_INTERVAL_MS));

    // Force GC if exposed
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

// ===== Exports for Testing =====
module.exports = { autonomousLoop, generateText, learnMemory, handlePatchCode };