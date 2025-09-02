// Connect to Casper's WebSocket server
const ws = new WebSocket('ws://' + location.host);

// Handle incoming messages
ws.onmessage = (msg) => {
    const chat = document.getElementById('chat');
    const div = document.createElement('div');
    div.textContent = msg.data;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight; // Auto-scroll
};

// Send message when "Send" button is clicked
document.getElementById('send').onclick = () => {
    const input = document.getElementById('message');
    if (input.value.trim() !== '') {
        ws.send(input.value);
        input.value = '';
    }
};

// Optional: send message on Enter key
document.getElementById('message').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('send').click();
    }
});