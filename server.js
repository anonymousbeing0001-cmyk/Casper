const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Database integrations
const { initMongoDB, storeInMongo, retrieveFromMongo } = require('./database/mongodb');
const { initSupabase, storeInSupabase } = require('./database/supabase');
const { initFirebase, storeInFirebase } = require('./database/firebase');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// AI Memory Core
let AI_coreMemory = {
  contextMemory: [],
  longTerm: {},
  patterns: {},
  relationships: {},
  connections: [],
  userProfiles: {}
};

// Initialize databases
async function initializeDatabases() {
  try {
    console.log('🔄 Initializing databases...');
    
    if (process.env.MONGODB_URI) {
      await initMongoDB();
      console.log('✅ MongoDB initialized');
    }
    
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      await initSupabase();
      console.log('✅ Supabase initialized');
    }
    
    if (process.env.FIREBASE_CONFIG) {
      await initFirebase();
      console.log('✅ Firebase initialized');
    }
    
    console.log('🎯 All databases initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  }
}

// Enhanced learning with multi-database storage
async function learn(userId, info) {
  if (!info || typeof info !== 'string') return;
  
  const cleanedInfo = info.trim().substring(0, 500);
  const words = cleanedInfo.split(' ');
  const category = words[0].toLowerCase() || 'misc';
  
  // Initialize user memory if not exists
  if (!AI_coreMemory.userProfiles[userId]) {
    AI_coreMemory.userProfiles[userId] = {
      longTerm: {},
      interests: [],
      knowledgeLevel: 'medium'
    };
  }
  
  const userMemory = AI_coreMemory.userProfiles[userId];
  
  // Store in memory
  if (!userMemory.longTerm[category]) userMemory.longTerm[category] = [];
  userMemory.longTerm[category].push(cleanedInfo);
  
  // Store in all available databases
  const dataToStore = {
    userId,
    content: cleanedInfo,
    category,
    timestamp: new Date(),
    type: 'memory'
  };
  
  try {
    if (process.env.MONGODB_URI) await storeInMongo(dataToStore);
    if (process.env.SUPABASE_URL) await storeInSupabase(dataToStore);
    if (process.env.FIREBASE_CONFIG) await storeInFirebase(dataToStore);
  } catch (error) {
    console.error('Storage error:', error);
  }
  
  // Update user profile
  updateUserProfile(userId, cleanedInfo);
}

function updateUserProfile(userId, text) {
  const lowerText = text.toLowerCase();
  const userMemory = AI_coreMemory.userProfiles[userId];
  
  // Detect interests
  const interestKeywords = {
    'technology': ['code', 'program', 'computer', 'software', 'tech', 'ai'],
    'science': ['science', 'research', 'physics', 'chemistry', 'biology'],
    'arts': ['art', 'music', 'creative', 'design', 'drawing'],
    'sports': ['sports', 'game', 'exercise', 'fitness', 'team']
  };
  
  for (const [interest, keywords] of Object.entries(interestKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      if (!userMemory.interests.includes(interest)) {
        userMemory.interests.push(interest);
      }
    }
  }
  
  // Update knowledge level based on vocabulary
  const complexWords = lowerText.match(/\b[a-z]{8,}\b/g) || [];
  if (complexWords.length > 3) {
    userMemory.knowledgeLevel = 'high';
  }
}

// Enhanced response generation
async function generateResponse(userId, input) {
  const lowerInput = input.toLowerCase();
  const userMemory = AI_coreMemory.userProfiles[userId] || {};
  
  // Special commands
  if (lowerInput === 'help') {
    return getHelpResponse();
  }
  
  if (lowerInput === 'database status') {
    return getDatabaseStatus();
  }
  
  if (lowerInput.includes('my profile')) {
    return getUserProfileResponse(userId);
  }
  
  // Try to retrieve from database
  try {
    if (process.env.MONGODB_URI) {
      const memories = await retrieveFromMongo(userId, { limit: 5 });
      if (memories.length > 0) {
        const memory = memories[Math.floor(Math.random() * memories.length)];
        return `👻 I remember: "${memory.content}"`;
      }
    }
  } catch (error) {
    console.error('Retrieval error:', error);
  }
  
  // Default responses
  if (["hello", "hi", "hey"].some(g => lowerInput.includes(g))) {
    return "👻 Hello! I'm CasperAI, your advanced AI assistant!";
  }
  
  if (["bye", "goodbye"].some(g => lowerInput.includes(g))) {
    return "👻 Goodbye! It was great chatting with you!";
  }
  
  // Personalized response based on user profile
  let personalization = "";
  if (userMemory.interests && userMemory.interests.length > 0) {
    personalization = ` I know you're interested in ${userMemory.interests.join(', ')}!`;
  }
  
  return `👻 I heard: "${input}".${personalization} Tell me more!`;
}

function getHelpResponse() {
  return `👻 **Available Commands:**
• help - Show this help
• database status - Check database connections
• my profile - View your profile
• learn faster - Enable accelerated learning
• generate password - Create secure passwords
• security scan - Check security status`;
}

function getDatabaseStatus() {
  let status = '👻 **Database Status:**\n';
  status += `• MongoDB: ${process.env.MONGODB_URI ? '✅ Connected' : '❌ Disabled'}\n`;
  status += `• Supabase: ${process.env.SUPABASE_URL ? '✅ Connected' : '❌ Disabled'}\n`;
  status += `• Firebase: ${process.env.FIREBASE_CONFIG ? '✅ Connected' : '❌ Disabled'}\n`;
  status += `• Memories stored: ${Object.values(AI_coreMemory.userProfiles).reduce((total, user) => total + Object.values(user.longTerm || {}).flat().length, 0)}`;
  return status;
}

function getUserProfileResponse(userId) {
  const userMemory = AI_coreMemory.userProfiles[userId];
  if (!userMemory) return "👻 I don't have a profile for you yet. Keep chatting with me!";
  
  return `👻 **Your Profile:**
• Interests: ${userMemory.interests.join(', ') || 'None yet'}
• Knowledge level: ${userMemory.knowledgeLevel}
• Memories: ${Object.values(userMemory.longTerm).flat().length}`;
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);
  
  socket.on('chat message', async (data) => {
    const { userId, message } = data;
    
    // Learn from the message
    await learn(userId || socket.id, message);
    
    // Generate response
    const response = await generateResponse(userId || socket.id, message);
    
    // Send response
    socket.emit('chat response', {
      message: response,
      timestamp: new Date()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    users: Object.keys(AI_coreMemory.userProfiles).length,
    memories: Object.values(AI_coreMemory.userProfiles).reduce((total, user) => total + Object.values(user.longTerm || {}).flat().length, 0),
    timestamp: new Date()
  });
});

app.post('/api/learn', async (req, res) => {
  try {
    const { userId, text } = req.body;
    await learn(userId, text);
    res.json({ success: true, message: 'Knowledge stored' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/profile/:userId', (req, res) => {
  const userId = req.params.userId;
  const userMemory = AI_coreMemory.userProfiles[userId];
  
  if (!userMemory) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    userId,
    interests: userMemory.interests,
    knowledgeLevel: userMemory.knowledgeLevel,
    memoryCount: Object.values(userMemory.longTerm).flat().length
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
async function startServer() {
  await initializeDatabases();
  
  server.listen(PORT, () => {
    console.log(`🚀 CasperAI server running on port ${PORT}`);
    console.log(`🌐 Open http://localhost:${PORT} to chat with CasperAI`);
  });
}

startServer().catch(console.error);