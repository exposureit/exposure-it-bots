const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { logWebhook } = require('../utils/logger');
const { generateClaimToken } = require('../utils/token');
const matcher = require('../services/matcher');
const notifier = require('../services/notifier');
const sheets = require('../services/sheets');
const slack = require('../services/slack');
const expiration = require('../services/expiration');

const router = express.Router();

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

router.post('/spiro/cancellation', async (req, res) => {
  const payload = req.body;

  // Log the raw webhook payload for debugging
  logWebhook(payload);
  console.log('[Webhook] Received Spiro cancellation:', JSON.stringify(payload, null, 2));

  // Acknowledge the webhook immediately
  res.status(200).json({ received: true });

  try {
    // Parse cancellation details from the payload
    // NOTE: Field names should be verified against actual Spiro webhook payload
    const cancellation = {
      date: payload.shoot_date || payload.date || payload.appointment_date || '',
      time: payload.shoot_time || payload.time || payload.appointment_time || '',
      area: payload.area || payload.location || payload.city || '',
      serviceType: payload.service_type || payload.service || payload.product || '',
      clientName: payload.client_name || payload.agent_name || payload.customer || '',
      orderId: payload.order_id || payload.booking_id || payload.reference || '',
    };

    // Post cancellation detection to Slack
    await slack.postToSlack(slack.formatCancellation(cancellation));

    // Find matching waitlisted agents
    const matches = await matcher.findMatches(cancellation);

    if (matches.length === 0) {
      await slack.postToSlack(slack.formatNoMatches(cancellation));
      return;
    }

    // Generate a unique cancellation event ID
    const cancellationId = uuidv4();
    const tokens = [];

    // Send notifications to all matching agents
    for (const agent of matches) {
      const token = generateClaimToken(agent.id, cancellationId);
      tokens.push({ agentId: agent.id, token });

      const claimLink = `${APP_BASE_URL}/claim/${token}`;
      await notifier.notifyAgentOfOpening(agent, cancellation, claimLink);
      await sheets.updateNotificationInfo(agent.id);
    }

    // Create expiration event
    expiration.createCancellationEvent(
      cancellationId,
      cancellation,
      matches,
      tokens
    );

    // Post notification summary to Slack
    const agentNames = matches.map((m) => m.agentName);
    await slack.postToSlack(slack.formatNotificationsSent(cancellation, agentNames));
  } catch (err) {
    console.error('[Webhook] Error processing cancellation:', err);
  }
});

module.exports = router;
