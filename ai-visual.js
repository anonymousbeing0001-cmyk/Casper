
const ws = new WebSocket(
  (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
);

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

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(() => {
    console.log("Service Worker registered");
  });
}
