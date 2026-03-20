const express = require('express');
const path = require('path');
const fs = require('fs');
const { verifyClaimToken } = require('../utils/token');
const expiration = require('../services/expiration');
const sheets = require('../services/sheets');
const notifier = require('../services/notifier');
const slack = require('../services/slack');

const router = express.Router();

function renderTemplate(filePath, replacements) {
  let html = fs.readFileSync(filePath, 'utf8');
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return html;
}

// Claim page — shows shoot details and claim button
router.get('/:token', async (req, res) => {
  const tokenData = verifyClaimToken(req.params.token);
  if (!tokenData) {
    return res.status(400).send('Invalid claim link.');
  }

  const { cancellationId } = tokenData;

  if (expiration.isClaimed(cancellationId) || expiration.isFilledExternally(cancellationId)) {
    return res.send(renderTemplate(path.join(__dirname, '..', 'views', 'claim-taken.html'), {}));
  }

  if (expiration.isExpired(cancellationId)) {
    return res.send(renderTemplate(path.join(__dirname, '..', 'views', 'claim-expired.html'), {}));
  }

  const event = expiration.getCancellationEvent(cancellationId);
  if (!event) {
    return res.status(404).send('Slot not found.');
  }

  const timeRemaining = expiration.getTimeRemaining(cancellationId);
  const minutesLeft = Math.ceil(timeRemaining / 60000);

  res.send(renderTemplate(path.join(__dirname, '..', 'views', 'claim-page.html'), {
    serviceType: event.details.bundleName || event.details.cancelledBy || '',
    date: event.details.shootDate,
    time: event.details.shootTime,
    duration: String(event.details.duration || ''),
    token: req.params.token,
    minutesLeft: String(minutesLeft),
  }));
});

// Claim action — process the claim
router.post('/:token', async (req, res) => {
  const tokenData = verifyClaimToken(req.params.token);
  if (!tokenData) {
    return res.status(400).send('Invalid claim link.');
  }

  const { waitlistId, cancellationId } = tokenData;

  if (expiration.isClaimed(cancellationId) || expiration.isFilledExternally(cancellationId)) {
    return res.send(renderTemplate(path.join(__dirname, '..', 'views', 'claim-taken.html'), {}));
  }

  if (expiration.isExpired(cancellationId)) {
    return res.send(renderTemplate(path.join(__dirname, '..', 'views', 'claim-expired.html'), {}));
  }

  const event = expiration.getCancellationEvent(cancellationId);
  if (!event) {
    return res.status(404).send('Slot not found.');
  }

  try {
    // Mark as claimed immediately (race condition protection)
    expiration.markClaimed(cancellationId, waitlistId);

    // Get the claiming agent's details
    const claimingAgent = await sheets.getEntryById(waitlistId);
    if (!claimingAgent) {
      return res.status(404).send('Agent not found.');
    }

    // Update waitlist status
    await sheets.updateEntryStatus(waitlistId, 'Claimed');

    // Update cancellation log
    if (event.eventId) {
      await sheets.updateCancellationStatus(event.eventId, 'Claimed', claimingAgent.agentName);
    }

    // Add to claim log
    await sheets.addClaimLogEntry({
      waitlistId,
      eventId: event.eventId || '',
      agentName: claimingAgent.agentName,
      agentPhone: claimingAgent.agentPhone,
      service: claimingAgent.serviceType,
      duration: claimingAgent.adjustedDuration || claimingAgent.baseDuration,
      listingAddress: claimingAgent.listingAddress,
      sqFt: claimingAgent.squareFootage,
    });

    // Send confirmation to claiming agent
    await notifier.notifyClaimConfirmation(claimingAgent, claimingAgent, event.details);

    // Post to Slack
    await slack.postToSlack(slack.formatSlotClaimed(claimingAgent, event.details));

    // Notify other agents that the slot was taken
    const otherAgents = event.notifiedAgents.filter((a) => a.id !== waitlistId);
    if (otherAgents.length > 0) {
      await notifier.notifyAgentsSlotTaken(otherAgents, event.details);
    }

    // Show success page
    res.send(renderTemplate(path.join(__dirname, '..', 'views', 'claim-success.html'), {
      serviceType: claimingAgent.serviceType,
      date: event.details.shootDate,
      time: event.details.shootTime,
      duration: String(claimingAgent.adjustedDuration || claimingAgent.baseDuration || ''),
      listingAddress: claimingAgent.listingAddress,
    }));
  } catch (err) {
    console.error('[Claim] Error:', err);
    res.status(500).send('Something went wrong. Please contact Exposure It at 412-709-5227.');
  }
});

module.exports = router;
