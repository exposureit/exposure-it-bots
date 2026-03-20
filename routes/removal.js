const express = require('express');
const path = require('path');
const fs = require('fs');
const { verifyRemovalToken } = require('../utils/token');
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

// Self-removal confirmation page
router.get('/:token', async (req, res) => {
  const tokenData = verifyRemovalToken(req.params.token);
  if (!tokenData) {
    return res.status(400).send('Invalid removal link.');
  }

  try {
    const entry = await sheets.getEntryById(tokenData.waitlistId);
    if (!entry) {
      return res.status(404).send('Waitlist entry not found.');
    }

    if (entry.status !== 'Active') {
      return res.send(renderTemplate(path.join(__dirname, '..', 'views', 'removal-already.html'), {
        status: entry.status,
      }));
    }

    res.send(renderTemplate(path.join(__dirname, '..', 'views', 'removal-confirm.html'), {
      agentName: entry.agentName,
      serviceType: entry.serviceType,
      duration: String(entry.adjustedDuration || entry.baseDuration || ''),
      listingAddress: entry.listingAddress,
      token: req.params.token,
    }));
  } catch (err) {
    console.error('[Removal] Error:', err);
    res.status(500).send('Something went wrong.');
  }
});

// Process self-removal
router.post('/:token', async (req, res) => {
  const tokenData = verifyRemovalToken(req.params.token);
  if (!tokenData) {
    return res.status(400).send('Invalid removal link.');
  }

  try {
    const entry = await sheets.getEntryById(tokenData.waitlistId);
    if (!entry) {
      return res.status(404).send('Waitlist entry not found.');
    }

    if (entry.status !== 'Active') {
      return res.send(renderTemplate(path.join(__dirname, '..', 'views', 'removal-already.html'), {
        status: entry.status,
      }));
    }

    // Update status
    await sheets.updateEntryStatus(tokenData.waitlistId, 'Removed (Self)');

    // Post to Slack
    await slack.postToSlack(slack.formatSelfRemoved(entry));

    // Send confirmation SMS + email
    await notifier.notifyRemovalConfirmation(entry);

    // Show success page
    res.send(renderTemplate(path.join(__dirname, '..', 'views', 'removal-success.html'), {
      serviceType: entry.serviceType,
      listingAddress: entry.listingAddress,
    }));
  } catch (err) {
    console.error('[Removal] Error:', err);
    res.status(500).send('Something went wrong.');
  }
});

module.exports = router;
