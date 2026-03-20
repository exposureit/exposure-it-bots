require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const expiration = require('./services/expiration');
const { ensureSheetSetup } = require('./services/sheets');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'frontend')));

// Routes (v9.0 spec endpoints)
app.use('/waitlist', require('./routes/waitlist'));
app.use('/webhooks', require('./routes/webhooks'));
app.use('/claim', require('./routes/claim'));
app.use('/remove', require('./routes/removal'));
app.use('/admin', require('./routes/admin'));

// Legacy intake route (redirect to new signup)
app.use('/', require('./routes/intake'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Home redirect to public signup
app.get('/', (req, res) => {
  res.redirect('/waitlist');
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
  const expiryMin = expiration.getExpiryMinutes();
  console.log(`Expiration checker started (checking every 60s, claim expiry: ${expiryMin}m)`);
});
