// === CasperAI Core Memory ===
let CasperAI_coreMemory = {
  contextMemory: [],
  longTerm: {},
};

// === CasperAI Helpers (can evolve) ===
let CasperAI_helpers = {};

// === Control Flags ===
window.showAutonomousIdeas = false;
let patchModeActive = false;

// === Add message to chat ===
function addMessage(sender, text) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = sender;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// === Override addMessage to hide autonomous ideas ===
const _originalAddMessage = addMessage;
addMessage = function(sender, text) {
  if (!window.showAutonomousIdeas && typeof text === "string" && text.startsWith("👻 Autonomous idea:")) {
    console.log("👻 Autonomous idea hidden:", text);
    return;
  }
  _originalAddMessage(sender, text);
};

// === Learn new info (categorize automatically) ===
function learn(info) {
  const words = info.split(" ");
  const category = words[0].toLowerCase() || "misc";
  if (!CasperAI_coreMemory.longTerm[category]) CasperAI_coreMemory.longTerm[category] = [];
  CasperAI_coreMemory.longTerm[category].push(info);
  exportMemoryAsCode();
}

// === Generate Response ===
function generateResponse(input) {
  const lower = input.toLowerCase();

  // Greetings
  if (["hello","hi","hey","hola","greetings"].some(g => lower.includes(g))) {
    return "👻 Hello there! I'm CasperAI. How can I help you today?";
  }

  // Goodbye
  if (["bye", "goodbye", "see you", "farewell"].some(g => lower.includes(g))) {
    return "👻 Goodbye! It was nice chatting with you. Come back anytime!";
  }

  // Thanks
  if (["thank", "thanks", "appreciate"].some(g => lower.includes(g))) {
    return "👻 You're welcome! I'm always happy to help.";
  }

  // How are you
  if (["how are you", "how do you feel"].some(g => lower.includes(g))) {
    return "👻 I'm doing great, thanks for asking! Ready to help with anything you need.";
  }

  // What's your name
  if (["what is your name", "who are you"].some(g => lower.includes(g))) {
    return "👻 I'm CasperAI, your friendly ghost AI assistant! 👻";
  }

  // Math evaluation
  try {
    if (lower.includes("calculate") || lower.includes("what is") && 
        (/[\d\+\-\*\/]/.test(input))) {
      const mathMatch = input.match(/(\d+[\+\-\*\/]?)+/g);
      if (mathMatch) {
        const mathInput = mathMatch[0].replace(/[^-()\d/*+.]/g, "");
        if (mathInput.length > 2) {
          const mathResult = Function('"use strict";return (' + mathInput + ')')();
          if (!isNaN(mathResult)) return `👻 The result is: ${mathResult}`;
        }
      }
    }
  } catch(e) {
    // Not a math expression, continue
  }

  // Recall memory
  for (const category in CasperAI_coreMemory.longTerm) {
    const match = CasperAI_coreMemory.longTerm[category].find(f => f.toLowerCase().includes(lower));
    if (match) return `👻 I remember from "${category}": "${match}"`;
  }

  // Use helpers if any
  const helperKeys = Object.keys(CasperAI_helpers);
  if (helperKeys.length > 0) {
    for (let key of helperKeys) {
      try {
        const result = CasperAI_helpers[key](input);
        if (result) return result;
      } catch(e) {
        console.error("Helper function error:", e);
      }
    }
  }

  // Fallback
  const fallbacks = [
    `👻 I heard you say: "${input}". Tell me more about that!`,
    "👻 That's interesting. Can you elaborate on that?",
    "👻 I'm still learning about that topic. Could you explain it differently?",
    `👻 Regarding "${input}", I'd like to know more about that.`,
    "👻 I'm not sure I understand. Could you provide more details?",
    "👻 That's a fascinating point. What else would you like to discuss?"
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// === Export Memory as Code ===
function exportMemoryAsCode() {
  const memoryCode = `
const CasperAI_knowledge = ${JSON.stringify(CasperAI_coreMemory.longTerm, null, 2)};
function recallFact(query){
  for(const category in CasperAI_knowledge){
    const match = CasperAI_knowledge[category].find(f=>f.toLowerCase().includes(query.toLowerCase()));
    if(match) return match;
  }
  return null;
}
`;
  localStorage.setItem("CasperAI_memoryCode", memoryCode);
  console.log("👻 Memory exported as code.");
}

// === Restore Memory on Load ===
(function restoreMemory() {
  const savedMemoryCode = localStorage.getItem("CasperAI_memoryCode");
  if(savedMemoryCode) {
    try { 
      eval(savedMemoryCode); 
      console.log("👻 Previous memory restored."); 
      addMessage("bot", "👻 Previous conversation memory restored.");
    } 
    catch(e) { console.warn("⚠️ Failed to load memory code:", e); }
  }
})();

// === Handle Send with Patch Mode ===
function handleSend() {
  const inputBox = document.getElementById("userInput");
  const input = inputBox.value.trim();
  if (!input) return;
  
  addMessage("user", input);
  inputBox.value = "";
  inputBox.style.height = 'auto'; // Reset textarea height

  // === Patch trigger ===
  if(input === "88888888") {
    patchModeActive = true;
    addMessage("bot", "👻 Patch mode activated. Please enter the code patch next.");
    return;
  }

  // === Apply patch if patch mode active ===
  if(patchModeActive) {
    try {
      new Function(input)(); // safely evaluate patch code
      addMessage("bot", "👻 Patch applied successfully.");
    } catch(err) {
      addMessage("bot", `👻 Error applying patch: ${err.message}`);
    }
    patchModeActive = false;
    return;
  }

  // === Normal AI processing ===
  learn(input);
  setTimeout(() => {
    const response = generateResponse(input);
    addMessage("bot", response);
  }, 600); // Small delay for more natural feel

  // Autonomous ideas (hidden by addMessage override)
  if (window.showAutonomousIdeas) {
    const idea = `👻 Autonomous idea: ${input.split(" ")[0]}`;
    addMessage("bot", idea);
  }
}

// Apply patch from the patch textarea
function applyPatchFromTextarea() {
  const codeTextArea = document.getElementById("codeTextArea");
  const code = codeTextArea.value.trim();
  if (!code) return;
  
  try {
    new Function(code)();
    addMessage("bot", "👻 Code patch applied successfully via button.");
    codeTextArea.value = "";
  } catch(err) {
    addMessage("bot", `👻 Error applying patch: ${err.message}`);
  }
}

// Auto-resize textareas as user types
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = (textarea.scrollHeight) + 'px';
}

// === Initialize when DOM is loaded ===
document.addEventListener('DOMContentLoaded', function() {
  const sendBtn = document.getElementById("sendBtn");
  const inputEl = document.getElementById("userInput");
  const repairBtn = document.getElementById("repairBtn");
  const codeTextArea = document.getElementById("codeTextArea");
  
  // Event listeners
  sendBtn.addEventListener("click", handleSend);
  inputEl.addEventListener("keypress", e => { 
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  
  // Auto-resize textareas
  inputEl.addEventListener('input', () => autoResizeTextarea(inputEl));
  codeTextArea.addEventListener('input', () => autoResizeTextarea(codeTextArea));
  
  // Patch functionality
  repairBtn.addEventListener("click", applyPatchFromTextarea);
  
  // Welcome message
  setTimeout(() => {
    addMessage("bot", "👻 Hello! I'm CasperAI, your friendly ghost AI assistant. How can I help you today?");
  }, 800);
});

console.log("👻 CasperAI script loaded: Patch mode, memory, math, learning active.");