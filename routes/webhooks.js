const express = require('express');
const matcher = require('../services/matcher');
const sheets = require('../services/sheets');
const slack = require('../services/slack');

const router = express.Router();

// Parse Spiro webhook payload into our internal format
function parseSpiroPayload(payload) {
  const agent = payload.Agent || {};
  const listing = payload.Listing || {};
  const clientName = [agent.FirstName, agent.LastName].filter(Boolean).join(' ') || 'Unknown';
  const address = [listing.AddressL1, listing.City, listing.State].filter(Boolean).join(', ') || '';

  let shootDate = '';
  let shootTime = '';
  if (payload.AppointmentDate) {
    const dt = new Date(payload.AppointmentDate);
    shootDate = dt.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    shootTime = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  }

  return {
    orderId: payload.OrderID || '',
    clientName,
    servicePackage: (payload.Bundle || {}).Name || '',
    duration: parseInt(payload.AppointmentExpectedDuration || '60', 10),
    shootDate,
    shootTime,
    location: address,
    photographer: payload.AssignedPhotographer || '',
  };
}

// ============================================================
// New Order (Order Created)
// ============================================================

router.post('/spiro/order', async (req, res) => {
  console.log('[Webhook] New order received:', req.body.OrderID || 'unknown');
  res.status(200).json({ received: true });

  try {
    const details = parseSpiroPayload(req.body);

    await sheets.addOrderLogEntry(details);
    await slack.postToSlack(slack.formatNewOrder(details));
  } catch (err) {
    console.error('[Webhook] Error processing order:', err);
  }
});

// ============================================================
// Cancellation
// ============================================================

router.post('/spiro/cancel', async (req, res) => {
  console.log('[Webhook] Cancellation received:', req.body.OrderID || 'unknown');
  res.status(200).json({ received: true });

  try {
    const details = parseSpiroPayload(req.body);

    // Find matching waitlist clients
    const matches = await matcher.findMatches({
      shootDate: details.shootDate,
      duration: details.duration,
    });

    // Log to Cancellation Log tab
    await sheets.addCancellationLogEntry({
      orderId: details.orderId,
      clientName: details.clientName,
      servicePackage: details.servicePackage,
      duration: details.duration,
      shootDate: details.shootDate,
      shootTime: details.shootTime,
      location: details.location,
      matchesFound: matches.length,
    });

    // Slack Carley with the cancellation + any matching waitlist clients
    await slack.postToSlack(slack.formatCancellationAlert(details, matches));
  } catch (err) {
    console.error('[Webhook] Error processing cancellation:', err);
  }
});

// ============================================================
// Reschedule
// ============================================================

router.post('/spiro/reschedule', async (req, res) => {
  console.log('[Webhook] Reschedule received:', req.body.OrderID || 'unknown');
  res.status(200).json({ received: true });

  try {
    const details = parseSpiroPayload(req.body);

    // The original date/time is in the payload; the new date may be in a
    // different field depending on Spiro's payload structure.
    // We treat the AppointmentDate as the ORIGINAL date for the freed-up slot.
    const originalDate = details.shootDate;
    const originalTime = details.shootTime;

    // Check for new appointment date if Spiro provides it
    let newDate = '';
    let newTime = '';
    if (req.body.NewAppointmentDate) {
      const dt = new Date(req.body.NewAppointmentDate);
      newDate = dt.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
      newTime = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    }

    // Find matching waitlist clients for the freed-up ORIGINAL slot
    const matches = await matcher.findMatches({
      shootDate: originalDate,
      duration: details.duration,
    });

    // Log to Reschedule Log tab
    await sheets.addRescheduleLogEntry({
      orderId: details.orderId,
      clientName: details.clientName,
      servicePackage: details.servicePackage,
      duration: details.duration,
      originalDate,
      originalTime,
      newDate,
      newTime,
      location: details.location,
      matchesFound: matches.length,
    });

    // Slack Carley with the reschedule + any matching waitlist clients
    const alertDetails = {
      ...details,
      originalDate,
      originalTime,
      newDate,
      newTime,
    };
    await slack.postToSlack(slack.formatRescheduleAlert(alertDetails, matches));
  } catch (err) {
    console.error('[Webhook] Error processing reschedule:', err);
  }
});

module.exports = router;
