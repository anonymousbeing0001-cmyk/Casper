const admin = require('firebase-admin');

let db;

function initFirebase() {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    db = admin.firestore();
    return true;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return false;
  }
}

async function storeInFirebase(data) {
  if (!db) return false;
  
  try {
    await db.collection('memories').add({
      ...data,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Firebase storage error:', error);
    return false;
  }
}

module.exports = {
  initFirebase,
  storeInFirebase
};