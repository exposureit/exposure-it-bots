const express = require('express');
const matcher = require('../services/matcher');
const sheets = require('../services/sheets');
const slack = require('../services/slack');

const router = express.Router();

// Parse Spiro webhook payload into our internal format
function parseSpiroPayload(payload) {
  const agent = payload.Agent || {};
  const listing = payload.Listing || {};
  const agentName = [agent.FirstName, agent.LastName].filter(Boolean).join(' ') || 'Unknown';

  let shootDate = '';
  let shootTime = '';
  if (payload.AppointmentDate) {
    const dt = new Date(payload.AppointmentDate);
    shootDate = dt.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    shootTime = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  }

  return {
    shootDate,
    shootTime,
    duration: parseInt(payload.AppointmentExpectedDuration || '60', 10),
    cancelledBy: agentName,
  };
}

// ============================================================
// Cancellation / Reschedule webhook
// ============================================================

async function processCancellation(payload) {
  const details = parseSpiroPayload(payload);

  // Find matching waitlist clients
  const matches = await matcher.findMatches({
    shootDate: details.shootDate,
    duration: details.duration,
  });

  // Log to Google Sheets
  await sheets.addCancellationLogEntry({
    shootDate: details.shootDate,
    shootTime: details.shootTime,
    duration: details.duration,
    cancelledBy: details.cancelledBy,
    matchesFound: matches.length,
  });

  // Send Carley the full alert with matches
  const message = slack.formatCancellationAlert(details, matches);
  await slack.postToSlack(message);
}

router.post('/spiro/cancel', async (req, res) => {
  console.log('[Webhook] Cancellation received:', req.body.OrderID || 'unknown');
  res.status(200).json({ received: true });

  try {
    await processCancellation(req.body);
  } catch (err) {
    console.error('[Webhook] Error processing cancellation:', err);
  }
});

router.post('/spiro/reschedule', async (req, res) => {
  console.log('[Webhook] Reschedule received:', req.body.OrderID || 'unknown');
  res.status(200).json({ received: true });

  try {
    await processCancellation(req.body);
  } catch (err) {
    console.error('[Webhook] Error processing reschedule:', err);
  }
});

module.exports = router;
