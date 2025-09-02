
// ====== server.js ======
const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

// === AI Core Memory ===
let AI_coreMemory = { contextMemory: [], longTerm: {} };
let AI_helpers = {};
let patchModeActive = false;

wss.on('connection', ws => {
  console.log('🔗 New client connected');
  ws.on('message', msg => {
    console.log('💬 Received:', msg.toString());

    // Simple AI echo logic for now
    let response = `AI Response: ${msg.toString()}`;

    ws.send(response);
  });

  ws.on('close', () => console.log('❌ Client disconnected'));
});
