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
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return html;
}

// Claim page — shows shoot details and claim button
router.get('/:token', (req, res) => {
  const tokenData = verifyClaimToken(req.params.token);
  if (!tokenData) {
    return res.status(400).send('Invalid claim link.');
  }

  const { cancellationId } = tokenData;

  // Check if already claimed
  if (expiration.isClaimed(cancellationId)) {
    const html = renderTemplate(
      path.join(__dirname, '..', 'views', 'claim-taken.html'),
      {}
    );
    return res.send(html);
  }

  // Check if expired
  if (expiration.isExpired(cancellationId)) {
    const html = renderTemplate(
      path.join(__dirname, '..', 'views', 'claim-expired.html'),
      {}
    );
    return res.send(html);
  }

  const event = expiration.getCancellationEvent(cancellationId);
  if (!event) {
    return res.status(404).send('Slot not found.');
  }

  const html = renderTemplate(
    path.join(__dirname, '..', 'views', 'claim-page.html'),
    {
      serviceType: event.details.serviceType,
      area: event.details.area,
      date: event.details.date,
      time: event.details.time,
      token: req.params.token,
    }
  );
  res.send(html);
});

// Claim action — process the claim
router.post('/:token', async (req, res) => {
  const tokenData = verifyClaimToken(req.params.token);
  if (!tokenData) {
    return res.status(400).send('Invalid claim link.');
  }

  const { waitlistId, cancellationId } = tokenData;

  // Check if already claimed
  if (expiration.isClaimed(cancellationId)) {
    const html = renderTemplate(
      path.join(__dirname, '..', 'views', 'claim-taken.html'),
      {}
    );
    return res.send(html);
  }

  // Check if expired
  if (expiration.isExpired(cancellationId)) {
    const html = renderTemplate(
      path.join(__dirname, '..', 'views', 'claim-expired.html'),
      {}
    );
    return res.send(html);
  }

  const event = expiration.getCancellationEvent(cancellationId);
  if (!event) {
    return res.status(404).send('Slot not found.');
  }

  try {
    // Mark as claimed (do this first to prevent race conditions)
    expiration.markClaimed(cancellationId, waitlistId);

    // Find the claiming agent's details
    const entries = await sheets.getActiveWaitlistEntries();
    const claimingAgent = entries.find((e) => e.id === waitlistId);

    if (!claimingAgent) {
      return res.status(404).send('Agent not found.');
    }

    // Update Google Sheets
    await sheets.updateEntryStatus(waitlistId, 'Claimed');

    // Add to claim log
    await sheets.addClaimLogEntry({
      waitlistId,
      agentName: claimingAgent.agentName,
      cancelledDate: event.details.date,
      cancelledTime: event.details.time,
      serviceType: event.details.serviceType,
      area: event.details.area,
    });

    // Send confirmation to the claiming agent
    await notifier.notifyAgentOfClaim(claimingAgent, event.details);

    // Post to Slack
    await slack.postToSlack(
      slack.formatSlotClaimed(claimingAgent.agentName, event.details)
    );

    // Notify other agents that the slot was taken
    const otherAgents = event.notifiedAgents.filter((a) => a.id !== waitlistId);
    if (otherAgents.length > 0) {
      await notifier.notifyAgentsSlotTaken(otherAgents, event.details);
    }

    // Show success page
    const html = renderTemplate(
      path.join(__dirname, '..', 'views', 'claim-success.html'),
      {
        serviceType: event.details.serviceType,
        area: event.details.area,
        date: event.details.date,
        time: event.details.time,
      }
    );
    res.send(html);
  } catch (err) {
    console.error('[Claim] Error:', err);
    res.status(500).send('Something went wrong. Please contact Exposure It directly.');
  }
});

module.exports = router;
