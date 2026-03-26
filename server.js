require('dotenv').config();
const express = require('express');
const { ensureSheetSetup } = require('./services/sheets');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/webhooks', require('./routes/webhooks'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    service: 'Exposure It Waitlist',
    status: 'running',
    endpoints: {
      webhooks: '/webhooks/spiro/cancel, /webhooks/spiro/reschedule',
      health: '/health',
    },
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Exposure It Waitlist server running on port ${PORT}`);

  try {
    await ensureSheetSetup();
  } catch (err) {
    console.error('Google Sheet setup failed (will retry on first request):', err.message);
  }
});
