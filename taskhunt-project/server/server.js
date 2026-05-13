const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/posts',       require('./routes/posts'));
app.use('/api/freelancers', require('./routes/freelancers'));
app.use('/api/admin',       require('./routes/admin'));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

// Fallback: serve index.html for any unknown route
app.get(/.*/, (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  TaskHunt server running at http://localhost:${PORT}\n`);
});
