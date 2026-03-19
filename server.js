const express = require('express');
const path = require('path');
const expiration = require('./services/expiration');
const { ensureSheetSetup } = require('./services/sheets');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve legacy static files
app.use('/static', express.static(path.join(__dirname, 'frontend')));

// Routes
app.use('/', require('./routes/intake'));
app.use('/webhooks', require('./routes/webhooks'));
app.use('/claim', require('./routes/claim'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Home redirect to intake form
app.get('/', (req, res) => {
  res.redirect('/add');
});

// Start server
app.listen(PORT, async () => {
  console.log(`Exposure It Waitlist server running on port ${PORT}`);

  // Auto-provision Google Sheet tabs and headers on startup
  try {
    await ensureSheetSetup();
  } catch (err) {
    console.error('Google Sheet setup failed (will retry on first request):', err.message);
  }

  expiration.startExpirationChecker();
  console.log('Expiration checker started (checking every 60s)');
});
