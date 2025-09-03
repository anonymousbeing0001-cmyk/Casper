// MemoryManager.js
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const sqlite3 = require('sqlite3').verbose();

// --- Local files ---
const memoryFile = path.join(__dirname, 'ai_memory.json');
const seedFile = path.join(__dirname, 'seed_urls.json');

// --- Load AI memory ---
let AI_coreMemory = fs.existsSync(memoryFile)
  ? JSON.parse(fs.readFileSync(memoryFile))
  : { contextMemory: [], longTerm: { summary: "", topics: {}, patches: [], suggestions: [], knowledgeBase: [] } };

// --- Seed URLs ---
let seedUrls = fs.existsSync(seedFile) ? JSON.parse(fs.readFileSync(seedFile)).seedUrls : [];

// --- Save memory locally ---
function writeMemory(memory) {
  fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2));
}

// --- Firebase Admin setup ---
let serviceAccount;
try {
  // Try loading local file first
  serviceAccount = require('./firebase-service.json');
} catch (err) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    console.warn('Firebase service account not found. Firebase will be disabled.');
  }
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
}

// --- Supabase setup ---
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// --- MongoDB setup ---
const mongoUri = process.env.MONGO_URI || '';
let mongoClient;
if (mongoUri) {
  mongoClient = new MongoClient(mongoUri);
  mongoClient.connect().then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB connection failed:', err));
}

// --- SQLite setup ---
const db = new sqlite3.Database(path.join(__dirname, 'casper_memory.sqlite'), (err) => {
  if (err) console.error('SQLite connection failed:', err.message);
});

// --- Sync distributed memory across all backends ---
async function syncDistributedMemory(memory) {
  // Firebase
  if (serviceAccount) {
    const ref = admin.database().ref('AI_memory');
    await ref.set(memory).catch(err => console.error('Firebase sync failed:', err));
  }

  // Supabase
  if (supabase) {
    await supabase.from('AI_memory').upsert([{ id: 1, data: memory }]).catch(err => console.error('Supabase sync failed:', err));
  }

  // MongoDB
  if (mongoClient) {
    const collection = mongoClient.db('Casper').collection('AI_memory');
    await collection.updateOne({}, { $set: { memory } }, { upsert: true }).catch(err => console.error('MongoDB sync failed:', err));
  }

  // SQLite
  db.run(`CREATE TABLE IF NOT EXISTS AI_memory (id INTEGER PRIMARY KEY, data TEXT)`);
  db.run(`INSERT OR REPLACE INTO AI_memory (id, data) VALUES (?, ?)`, [1, JSON.stringify(memory)], err => {
    if (err) console.error('SQLite sync failed:', err);
  });
}

// --- Exports ---
module.exports = { writeMemory, readMemory: () => AI_coreMemory, syncDistributedMemory, seedUrls };