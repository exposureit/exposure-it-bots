const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { logWebhook } = require('../utils/logger');
const { generateClaimToken, generateRemovalToken } = require('../utils/token');
const matcher = require('../services/matcher');
const notifier = require('../services/notifier');
const sheets = require('../services/sheets');
const slack = require('../services/slack');
const expiration = require('../services/expiration');

const router = express.Router();
const BASE_URL = process.env.BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000';

// Parse Spiro webhook payload into our internal format
function parseSpiroPayload(payload) {
  const agent = payload.Agent || {};
  const listing = payload.Listing || {};
  const agentName = [agent.FirstName, agent.LastName].filter(Boolean).join(' ') || 'Unknown';
  const address = [listing.AddressL1, listing.City, listing.State].filter(Boolean).join(', ') || '';

  // Parse appointment date/time
  let shootDate = '';
  let shootTime = '';
  if (payload.AppointmentDate) {
    const dt = new Date(payload.AppointmentDate);
    shootDate = dt.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    shootTime = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  }

  return {
    orderId: payload.OrderID || '',
    status: payload.Status || '',
    shootDate,
    shootTime,
    appointmentDate: payload.AppointmentDate || '',
    duration: parseInt(payload.AppointmentExpectedDuration || '60', 10),
    cancelledBy: agentName,
    address,
    bundleName: (payload.Bundle || {}).Name || '',
    addOns: (payload.AddOns || []).map((a) => a.Name),
  };
}

// ============================================================
// Webhook 1: Spiro Cancellation
// ============================================================
router.post('/spiro/cancel', async (req, res) => {
  const payload = req.body;
  logWebhook(payload);
  console.log('[Webhook] Cancellation received:', payload.OrderID || 'unknown');

  res.status(200).json({ received: true });

  try {
    await processCancellation(payload);
  } catch (err) {
    console.error('[Webhook] Error processing cancellation:', err);
  }
});

// ============================================================
// Webhook 2: Spiro Rescheduled (treated identically to cancel)
// ============================================================
router.post('/spiro/reschedule', async (req, res) => {
  const payload = req.body;
  logWebhook(payload);
  console.log('[Webhook] Reschedule received:', payload.OrderID || 'unknown');

  res.status(200).json({ received: true });

  try {
    await processCancellation(payload);
  } catch (err) {
    console.error('[Webhook] Error processing reschedule:', err);
  }
});

// Shared logic for cancellation + reschedule
async function processCancellation(payload) {
  const details = parseSpiroPayload(payload);

  // Post to Slack
  await slack.postToSlack(slack.formatCancellation(details));

  // Add to Cancellation Log in Google Sheets
  const eventId = await sheets.addCancellationLogEntry({
    shootDate: details.shootDate,
    shootTime: details.shootTime,
    duration: details.duration,
    cancelledBy: details.cancelledBy,
  });

  // Find matching agents
  const { matches, skipped } = await matcher.findMatches({
    shootDate: details.shootDate,
    duration: details.duration,
  });

  // Post skip reasons to Slack
  for (const skip of skipped) {
    if (skip.reason === 'duration') {
      await slack.postToSlack(slack.formatAgentSkippedDuration(skip.entry, details.duration));
    } else if (skip.reason === 'date') {
      await slack.postToSlack(slack.formatAgentSkippedDate(skip.entry));
    }
  }

  if (matches.length === 0) {
    await slack.postToSlack(slack.formatNoMatches(details));
    await sheets.updateCancellationCounts(eventId, 0, skipped.length);
    return;
  }

  // Multi-listing consolidation (Filter 5)
  const consolidated = matcher.consolidateByAgent(matches, skipped);
  const cancellationId = uuidv4();
  const allTokens = [];
  const allNotifiedAgents = [];

  for (const [phone, group] of consolidated.entries()) {
    const { agent, matchingEntries, skippedEntries } = group;

    if (matchingEntries.length === 1) {
      // Single listing notification
      const entry = matchingEntries[0];
      const claimToken = generateClaimToken(entry.id, cancellationId);
      const removalToken = generateRemovalToken(entry.id);
      allTokens.push({ agentId: entry.id, token: claimToken });

      await notifier.notifySingleListing(agent, entry, details, claimToken, removalToken);
      await sheets.updateNotificationInfo(entry.id);
      allNotifiedAgents.push(entry);
    } else {
      // Multi-listing consolidated notification
      const claimTokens = {};
      for (const entry of matchingEntries) {
        const token = generateClaimToken(entry.id, cancellationId);
        claimTokens[entry.id] = token;
        allTokens.push({ agentId: entry.id, token });
        await sheets.updateNotificationInfo(entry.id);
        allNotifiedAgents.push(entry);
      }
      const removalToken = generateRemovalToken(matchingEntries[0].id);

      await notifier.notifyMultiListing(agent, matchingEntries, skippedEntries, details, claimTokens, removalToken);
      await slack.postToSlack(slack.formatMultiListingConsolidated(agent.agentName, matchingEntries.length));
    }
  }

  // Create in-memory expiration event
  expiration.createCancellationEvent(cancellationId, details, allNotifiedAgents, allTokens, eventId);

  // Update cancellation log counts
  await sheets.updateCancellationCounts(eventId, allNotifiedAgents.length, skipped.length);

  // Post summary to Slack
  await slack.postToSlack(
    slack.formatNotificationsSent(details, allNotifiedAgents.length, matches.length + skipped.length, skipped.length)
  );
}

// ============================================================
// Webhook 3: Spiro New Booking (Order Created)
// ============================================================
router.post('/spiro/booking', async (req, res) => {
  const payload = req.body;
  logWebhook(payload);
  console.log('[Webhook] New booking received:', payload.OrderID || 'unknown');

  res.status(200).json({ received: true });

  try {
    const details = parseSpiroPayload(payload);

    // Check if this booking fills any open cancellation slots
    const openSlots = expiration.findOpenSlotsByTime(
      details.appointmentDate,
      details.duration
    );

    for (const { cancellationId, event } of openSlots) {
      // Mark as filled externally
      expiration.markFilledExternally(cancellationId);

      // Update Google Sheet
      if (event.eventId) {
        await sheets.updateCancellationStatus(event.eventId, 'Filled Externally', `Spiro #${details.orderId}`);
      }

      // Post to Slack (no SMS to agents — silent)
      await slack.postToSlack(slack.formatFilledExternally(event.details));
    }
  } catch (err) {
    console.error('[Webhook] Error processing new booking:', err);
  }
});

module.exports = router;
