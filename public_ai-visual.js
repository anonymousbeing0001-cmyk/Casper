const ws = new WebSocket('ws://' + location.host);

ws.onmessage = (msg) => {
    const chat = document.getElementById('chat');
    const div = document.createElement('div');
    div.textContent = msg.data;
    chat.appendChild(div);
};

function sendMessage() {
    const input = document.getElementById('message');
    ws.send(input.value);
    input.value = '';
}
