// ====== server.js ======
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from root (flattened)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public_index.html')));
app.get('/ai-visual.js', (req, res) => res.sendFile(path.join(__dirname, 'public_ai-visual.js')));

const server = app.listen(PORT, () => console.log('Server running on port', PORT));

const wss = new WebSocket.Server({ server });

// === AI Core Memory ===
let AI_coreMemory = { contextMemory: [], longTerm: {} };
let AI_helpers = {};
let patchModeActive = false;

wss.on('connection', ws => {
    ws.on('message', msg => {
        console.log('Received:', msg.toString());
        // simple echo logic for now
        ws.send('AI Response: ' + msg.toString());
    });
});
