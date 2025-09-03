// MemoryManager.js
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');

// --- Local JSON Storage ---
const memoryFile = path.join(__dirname, 'ai_memory.json');

// --- MongoDB Setup ---
const mongoUri = process.env.MONGO_URI || 'mongodb+srv://casperUser:password@memorycore.x5sc8av.mongodb.net/?retryWrites=true&w=majority';
const mongoClient = new MongoClient(mongoUri);
let mongoDB;

// --- Supabase Setup ---
const supabaseUrl = process.env.SUPABASE_URL || 'https://yourproject.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Firebase Setup ---
const serviceAccount = require('./firebase-service.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const firestore = admin.firestore();

// --- Read Memory ---
function readMemory() {
    if (fs.existsSync(memoryFile)) {
        return JSON.parse(fs.readFileSync(memoryFile));
    }
    return {
        contextMemory: [],
        longTerm: {
            summary: "Casper starts with foundational knowledge in AI, programming, memory management, and reasoning.",
            topics: {},
            patches: [],
            suggestions: [],
            knowledgeBase: []
        }
    };
}

// --- Write Memory Locally ---
function writeMemory(memory) {
    fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2));
}

// --- Sync Distributed Memory ---
async function syncDistributedMemory(memory) {
    // 1. MongoDB
    try {
        if (!mongoDB) {
            await mongoClient.connect();
            mongoDB = mongoClient.db('casper_memory');
        }
        const collection = mongoDB.collection('knowledge');
        for (let item of memory.longTerm.knowledgeBase) {
            await collection.updateOne(
                { text: item.text },
                { $set: item },
                { upsert: true }
            );
        }
    } catch (e) {
        console.error('MongoDB sync failed:', e.message);
    }

    // 2. Supabase
    try {
        for (let item of memory.longTerm.knowledgeBase) {
            await supabase.from('knowledge').upsert([{
                text: item.text,
                source: item.source,
                timestamp: item.timestamp,
                trustScore: item.trustScore,
                verified: item.verified
            }]);
        }
    } catch (e) {
        console.error('Supabase sync failed:', e.message);
    }

    // 3. Firebase
    try {
        const batch = firestore.batch();
        memory.longTerm.knowledgeBase.forEach(item => {
            const docRef = firestore.collection('knowledge').doc(encodeURIComponent(item.text).slice(0, 100));
            batch.set(docRef, item, { merge: true });
        });
        await batch.commit();
    } catch (e) {
        console.error('Firebase sync failed:', e.message);
    }
}

// --- Deduplicate Knowledge Base ---
function deduplicateMemory(memory) {
    const seen = new Set();
    memory.longTerm.knowledgeBase = memory.longTerm.knowledgeBase.filter(k => {
        if (seen.has(k.text)) return false;
        seen.add(k.text);
        return true;
    });
}

// --- Exported Functions ---
module.exports = {
    readMemory,
    writeMemory,
    syncDistributedMemory,
    deduplicateMemory
};