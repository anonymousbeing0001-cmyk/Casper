const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/ai-visual.js', (req, res) => res.sendFile(path.join(__dirname, 'ai-visual.js')));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/icon.png', (req, res) => res.sendFile(path.join(__dirname, 'icon.png')));
app.get('/web-learner.js', (req, res) => res.sendFile(path.join(__dirname, 'web-learner.js')));
app.get('/ai_memory.json', (req, res) => res.sendFile(path.join(__dirname, 'ai_memory.json')));
app.get('/seed_urls.json', (req, res) => res.sendFile(path.join(__dirname, 'seed_urls.json')));

const server = app.listen(PORT, () => console.log('Server running on port', PORT));
const wss = new WebSocket.Server({ server });

// Load memory
let memoryFile = path.join(__dirname, 'ai_memory.json');
let AI_coreMemory = fs.existsSync(memoryFile)
    ? JSON.parse(fs.readFileSync(memoryFile))
    : { contextMemory: [], longTerm: { summary: "", topics: {}, patches: [], suggestions: [], knowledgeBase: [] } };

// WebSocket logic
wss.on('connection', ws => {
    ws.on('message', async msg => {
        console.log('Received:', msg.toString());
        let text = msg.toString().trim();

        // Patch system
        if (text.startsWith('88888888')) {
            let lines = text.split('\n');
            let filename = lines[0].replace('88888888', '').trim();
            let code = lines.slice(1).join('\n');
            try {
                fs.writeFileSync(path.join(__dirname, filename), code);
                AI_coreMemory.longTerm.patches.push({ filename, code, timestamp: Date.now() });
                ws.send('Patch applied successfully to ' + filename);
            } catch (e) { ws.send('Patch failed: ' + e.message); }
            saveMemory();
            return;
        }

        // Commands
        if (text.startsWith('/history')) {
            ws.send(JSON.stringify(AI_coreMemory.contextMemory.slice(-50), null, 2));
            return;
        }
        if (text.startsWith('/toptopics')) {
            ws.send(JSON.stringify(AI_coreMemory.longTerm.topics, null, 2));
            return;
        }
        if (text.startsWith('/verify')) {
            ws.send('Fact verification placeholder');
            return;
        }

        // Add message to memory
        AI_coreMemory.contextMemory.push({ user: text, timestamp: Date.now() });
        AI_coreMemory.longTerm.topics[text] = (AI_coreMemory.longTerm.topics[text] || 0) + 1;
        saveMemory();

        // Simple response
        ws.send('Casper: I have received "' + text + '"');
    });
});

function saveMemory() {
    fs.writeFileSync(memoryFile, JSON.stringify(AI_coreMemory, null, 2));
}