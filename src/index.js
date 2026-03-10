require('dotenv').config();
const express = require('express');
const cors = require('cors');
const analyzeRoute = require('./routes/analyze');

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' })); // contracts can be large

// ── ROUTES ───────────────────────────────────────────
app.use('/api', analyzeRoute);

// ── HEALTH CHECK ─────────────────────────────────────
// Simple endpoint to verify the server is running
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── 404 HANDLER ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── GLOBAL ERROR HANDLER ─────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── START SERVER ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Contract Risk API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
