// Client-side JavaScript
const socket = io();
let userId = 'user_' + Math.random().toString(36).substr(2, 9);

function addMessage(sender, text) {
    const chat = document.getElementById("chat");
    const div = document.createElement("div");
    div.className = sender;
    
    // Process text for better formatting
    const processedText = text.replace(/\n/g, '<br>')
                             .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
                             .replace(/👻/g, '👻')
                             .replace(/✅/g, '✅')
                             .replace(/❌/g, '❌');
    
    div.innerHTML = processedText;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function handleSend() {
    const inputBox = document.getElementById("userInput");
    const input = inputBox.value.trim();
    if (!input) return;
    
    addMessage("user", input);
    inputBox.value = "";
    inputBox.style.height = 'auto';

    // Send message to server
    socket.emit('chat message', {
        userId: userId,
        message: input
    });
}

// Receive messages from server
socket.on('chat response', (data) => {
    addMessage("bot", data.message);
});

socket.on('connect', () => {
    document.getElementById('info').innerHTML = '<p>Type "help" for commands | ✅ Connected to server</p>';
    addMessage("bot", "👻 Hello! I'm CasperAI, your advanced AI assistant!");
    addMessage("bot", "👻 Type 'help' to see available commands.");
});

socket.on('disconnect', () => {
    document.getElementById('info').innerHTML = '<p>Type "help" for commands | ❌ Disconnected from server</p>';
});

// UI Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    const sendBtn = document.getElementById("sendBtn");
    const inputEl = document.getElementById("userInput");
    const repairBtn = document.getElementById("repairBtn");
    const codeTextArea = document.getElementById("codeTextArea");
    const helpBtn = document.getElementById("helpBtn");
    
    // Event listeners
    sendBtn.addEventListener("click", handleSend);
    inputEl.addEventListener("keypress", e => { 
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
    
    inputEl.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    repairBtn.addEventListener("click", function() {
        const code = codeTextArea.value.trim();
        if (!code) return;
        
        try {
            new Function(code)();
            addMessage("bot", "👻 Code patch applied successfully via button.");
            codeTextArea.value = "";
        } catch(err) {
            addMessage("bot", `👻 Error applying patch: ${err.message}`);
        }
    });
    
    helpBtn.addEventListener("click", function() {
        socket.emit('chat message', {
            userId: userId,
            message: 'help'
        });
    });
    
    // Status indicator animation
    setInterval(() => {
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            statusIndicator.style.background = '#4caf50';
            setTimeout(() => {
                if (statusIndicator) statusIndicator.style.background = '#2e7d32';
            }, 500);
        }
    }, 5000);
});