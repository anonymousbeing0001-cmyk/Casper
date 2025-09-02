// Determine protocol for WebSocket (wss for HTTPS, ws for HTTP)
const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
const ws = new WebSocket(protocol + location.host);

// Handle incoming messages
ws.onmessage = (msg) => {
    const chat = document.getElementById('chat');
    const div = document.createElement('div');
    div.textContent = msg.data;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight; // Auto-scroll
};

// Handle WebSocket errors
ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    const chat = document.getElementById('chat');
    const div = document.createElement('div');
    div.textContent = '[Error connecting to Casper]';
    div.style.color = 'red';
    chat.appendChild(div);
};

// Send message when "Send" button is clicked
document.getElementById('send').onclick = () => {
    const input = document.getElementById('message');
    if (input.value.trim() !== '') {
        ws.send(input.value.trim());
        // Optionally display the user's message
        const chat = document.getElementById('chat');
        const div = document.createElement('div');
        div.textContent = 'You: ' + input.value.trim();
        div.style.fontWeight = 'bold';
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
        input.value = '';
    }
};

// Optional: send message on Enter key
document.getElementById('message').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('send').click();
    }
});