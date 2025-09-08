const mongoose = require('mongoose');

let memoryModel;

async function initMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Define schema
    const memorySchema = new mongoose.Schema({
      userId: String,
      content: String,
      category: String,
      type: String,
      timestamp: { type: Date, default: Date.now }
    });
    
    memoryModel = mongoose.model('Memory', memorySchema);
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return false;
  }
}

async function storeInMongo(data) {
  if (!memoryModel) return false;
  
  try {
    const memory = new memoryModel(data);
    await memory.save();
    return true;
  } catch (error) {
    console.error('MongoDB storage error:', error);
    return false;
  }
}

async function retrieveFromMongo(userId, options = {}) {
  if (!memoryModel) return [];
  
  try {
    const query = { userId };
    const memories = await memoryModel.find(query)
      .sort({ timestamp: -1 })
      .limit(options.limit || 10);
    
    return memories;
  } catch (error) {
    console.error('MongoDB retrieval error:', error);
    return [];
  }
}

module.exports = {
  initMongoDB,
  storeInMongo,
  retrieveFromMongo
};