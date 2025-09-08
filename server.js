const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// API endpoint to get app info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'CasperAI',
    version: '1.0.0',
    description: 'Friendly AI Chat Assistant'
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`CasperAI is running on port ${port}`);
  console.log(`Open http://localhost:${port} to chat with CasperAI`);
});