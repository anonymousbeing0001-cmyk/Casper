const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { writeMemory, readMemory, syncDistributedMemory } = require('./MemoryManager');
const { startLearning } = require('./web-learner');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/ai-visual.js', (req, res) => res.sendFile(path.join(__dirname, 'ai-visual.js')));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/icon.png', (req, res) => res.sendFile(path.join(__dirname, 'icon.png')));
app.get('/ai_memory.json', (req, res) => res.sendFile(path.join(__dirname, 'ai_memory.json')));
app.get('/seed_urls.json', (req, res) => res.sendFile(path.join(__dirname, 'seed_urls.json')));

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const wss = new WebSocket.Server({ server });

// Load memory asynchronously on startup
let AI_coreMemory = {};
(async () => {
    AI_coreMemory = await readMemory();
})();

// WebSocket logic
wss.on('connection', ws => {
    ws.on('message', async msg => {
        const text = msg.toString().trim();

        // Patch system
        if (text.startsWith('88888888')) {
            const lines = text.split('\n');
            const filename = lines[0].replace('88888888', '').trim();
            const code = lines.slice(1).join('\n');
            try {
                require('fs').writeFileSync(path.join(__dirname, filename), code);
                AI_coreMemory.longTerm.patches.push({ filename, code, timestamp: Date.now() });
                await writeMemory(AI_coreMemory);
                await syncDistributedMemory(AI_coreMemory);
                ws.send(`Patch applied successfully to ${filename}`);
            } catch (e) { 
                ws.send(`Patch failed: ${e.message}`); 
            }
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

        // Add user message to memory
        AI_coreMemory.contextMemory.push({ user: text, timestamp: Date.now() });
        AI_coreMemory.longTerm.topics[text] = (AI_coreMemory.longTerm.topics[text] || 0) + 1;

        // Generate AI response
        let response = generateResponse(text);
        AI_coreMemory.contextMemory.push({ casper: response, timestamp: Date.now() });

        // Save locally and sync distributed memory asynchronously
        await writeMemory(AI_coreMemory);
        await syncDistributedMemory(AI_coreMemory);

        ws.send(response);
    });
});

// Simple AI response generator
function generateResponse(userText) {
    if (userText.endsWith('?')) return `Casper: I see you asked a question about "${userText}". Let's think about that.`;
    if (userText.length < 20) return `Casper: You said "${userText}", let's discuss more!`;
    return `Casper: I have received "${userText}"`;
}

// Start web learning asynchronously
startLearning();