// server.js - Fixed version
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { autoProvisionAll, getProviders } = require('./autoprovision');
const { initMongo, saveKnowledge, fetchKnowledge } = require('./mongo-memory');
const { learnText, generateSentence, generateWord, getVocabulary } = require('./language-builder');
const admin = require('./firebase-init');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const vm = require('vm');
const chokidar = require('chokidar');
const crypto = require('crypto');
const ejs = require('ejs');
const cheerio = require('cheerio');
const morgan = require('morgan');
const winston = require('winston');
require('dotenv').config();

// ===================== LOGGING SETUP =====================
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: path.join(logDir, 'server.log') })
    ]
});

function logMessage(level, message) {
    logger.log({ level, message });
}

// ===================== SERVER SETUP =====================
const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());
app.use(express.static('.')); // Serve static files
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ===================== SUPABASE CLIENT =====================
let supabase = null;
if (process.env.SUPABASE_KEY && process.env.SUPABASE_URL) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
} else {
    logMessage('warn', 'Supabase credentials not found - Supabase functionality disabled');
}

// ===================== AI MEMORY =====================
let AI_coreMemory = {
    contextMemory: [],
    longTerm: {},
    metrics: {}
};

let AI_helpers = {};
let patchModeActive = false;

// ===================== HEARTBEAT STATUS =====================
let heartbeatStatus = {
    firebase: false,
    mongo: false,
    supabase: false,
};

// ===================== CASPER METRICS =====================
const casperMetrics = {
    activeShards: 0,
    activeOps: 0,
    successes: 0,
    failures: 0,
};

function broadcastMetrics() {
    const message = JSON.stringify({ type: 'metrics', data: casperMetrics });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    });
}

function updateCasperMetrics(newMetrics) {
    Object.assign(casperMetrics, newMetrics);
    broadcastMetrics();
}

// ===================== STORAGE HEARTBEAT =====================
async function storageHeartbeat() {
    try {
        // Firebase
        try {
            if (admin) {
                await admin.firestore().collection('_heartbeat').doc('ping').set({ timestamp: new Date() });
                heartbeatStatus.firebase = true;
            }
        } catch { heartbeatStatus.firebase = false; }

        // MongoDB
        try {
            await saveKnowledge({ shard: '_heartbeat', text: 'ping', timestamp: new Date() });
            heartbeatStatus.mongo = true;
        } catch { heartbeatStatus.mongo = false; }

        // Supabase
        try {
            if (supabase) {
                const { error } = await supabase.from('knowledge').insert([{ shard: '_heartbeat', text: 'ping', created_at: new Date() }]);
                heartbeatStatus.supabase = !error;
            }
        } catch { heartbeatStatus.supabase = false; }

        logMessage('info', `[Heartbeat] Firebase: ${heartbeatStatus.firebase}, MongoDB: ${heartbeatStatus.mongo}, Supabase: ${heartbeatStatus.supabase}`);
    } catch (err) {
        logMessage('error', `[Heartbeat] Error: ${err.message}`);
    } finally {
        setTimeout(storageHeartbeat, 60000);
    }
}

// ===================== OPTIMAL STORAGE =====================
async function storeOptimally(shard, text) {
    try {
        if (text.length < 50 && heartbeatStatus.firebase) {
            await admin.firestore().collection(shard).add({ text, timestamp: new Date() });
            logMessage('info', `[Storage] Stored in Firebase (shard: ${shard})`);
        } else if (text.length < 200 && heartbeatStatus.mongo) {
            await saveKnowledge({ shard, text, timestamp: new Date() });
            logMessage('info', `[Storage] Stored in MongoDB (shard: ${shard})`);
        } else if (heartbeatStatus.supabase && supabase) {
            const { error } = await supabase.from('knowledge').insert([{ shard, text, created_at: new Date() }]);
            if (error) throw error;
            logMessage('info', `[Storage] Stored in Supabase (shard: ${shard})`);
        } else if (heartbeatStatus.mongo) {
            await saveKnowledge({ shard, text, timestamp: new Date() });
            logMessage('info', `[Storage] Fallback to MongoDB (shard: ${shard})`);
        } else {
            logMessage('error', '[Storage] No healthy storage available!');
        }
    } catch (err) {
        logMessage('error', `[Storage] Failed: ${err.message}`);
    }
}

// ===================== WEBSOCKET CHAT =====================
wss.on('connection', ws => {
    logMessage('info', '[WebSocket] New client connected');

    ws.on('message', async message => {
        let text;
        try {
            const msg = JSON.parse(message.toString());
            if (msg.type === 'casperMetrics') {
                AI_coreMemory.metrics = msg.data;
                return;
            }
            text = msg.text || '';
        } catch {
            text = message.toString();
        }

        logMessage('info', `[WebSocket] Received: ${text}`);

        let shard = 'default';
        let content = text;
        const match = text.match(/^shard:(\w+)\|(.+)/);
        if (match) { shard = match[1]; content = match[2]; }

        try {
            await learnText(content, shard);
            await storeOptimally(shard, content);

            let aiReply = await generateSentence(8, shard);
            if (!aiReply || !aiReply.trim()) aiReply = 'Hmm... I am thinking 🤖';
            ws.send(JSON.stringify({ type: 'aiReply', text: aiReply }));
        } catch (e) {
            logMessage('error', `[WebSocket] Error: ${e.message}`);
            ws.send(JSON.stringify({ type: 'aiReply', text: 'Oops, something went wrong 🤖' }));
        }
    });

    ws.on('close', () => {
        logMessage('info', '[WebSocket] Client disconnected');
    });
});

// ===================== DASHBOARD =====================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Create views directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'views'))) {
    fs.mkdirSync(path.join(__dirname, 'views'));
}

app.get('/dashboard', async (req, res) => {
    try {
        res.render('dashboard', {
            heartbeat: heartbeatStatus,
            contextMemoryCount: AI_coreMemory.contextMemory.length,
            longTermKeys: Object.keys(AI_coreMemory.longTerm),
            helpersList: Object.keys(AI_helpers),
            serverConfig: { port: PORT }
        });
    } catch (err) {
        res.status(500).send(`Dashboard error: ${err.message}`);
    }
});

// Create default dashboard template
const dashboardTemplate = path.join(__dirname, 'views', 'dashboard.ejs');
if (!fs.existsSync(dashboardTemplate)) {
    const defaultTemplate = `<!DOCTYPE html>
<html>
<head>
    <title>Casper AI Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f0f0f0; }
        .status { padding: 10px; margin: 5px; border-radius: 5px; }
        .online { background: #d4edda; color: #155724; }
        .offline { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
<h1>Casper AI Dashboard</h1>
<div class="status <%= heartbeat.firebase ? 'online' : 'offline' %>">Firebase: <%= heartbeat.firebase %></div>
<div class="status <%= heartbeat.mongo ? 'online' : 'offline' %>">MongoDB: <%= heartbeat.mongo %></div>
<div class="status <%= heartbeat.supabase ? 'online' : 'offline' %>">Supabase: <%= heartbeat.supabase %></div>
<p>Context Memory Entries: <%= contextMemoryCount %></p>
<p>Long Term Keys: <%= longTermKeys.join(', ') %></p>
<p>Helpers: <%= helpersList.join(', ') %></p>
<p>Server running on port: <%= serverConfig.port %></p>
</body>
</html>`;
    fs.writeFileSync(dashboardTemplate, defaultTemplate);
}

// ===================== API ENDPOINTS =====================
app.post('/learnText', async (req, res) => {
    try {
        const { text, shard } = req.body;
        if (!text) throw new Error("Missing 'text' in body");
        await learnText(text, shard || 'default');
        await storeOptimally(shard || 'default', text);
        res.json({ ok: true });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

app.get('/generateSentence', async (req, res) => {
    try {
        const shard = req.query.shard || 'default';
        const length = parseInt(req.query.length || '8', 10);
        const sentence = await generateSentence(length, shard);
        res.json({ ok: true, sentence });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date(),
        storage: heartbeatStatus
    });
});

// ===================== SERVER INIT =====================
async function initServer() {
    try {
        await initMongo();
        storageHeartbeat();
        
        server.listen(PORT, () => {
            logMessage('info', `[Casper AI] Server running on http://localhost:${PORT}`);
            logMessage('info', `[Dashboard] Available at http://localhost:${PORT}/dashboard`);
        });
    } catch (err) {
        logMessage('error', `[Server Init] Failed: ${err.message}`);
    }
}

initServer();

module.exports = { app, server };