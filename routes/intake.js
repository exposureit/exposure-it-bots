const express = require('express');
const path = require('path');
const sheets = require('../services/sheets');
const slack = require('../services/slack');

const router = express.Router();

// Serve the intake form
router.get('/add', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'intake-form.html'));
});

// Handle form submission
router.post('/add', async (req, res) => {
  try {
    const {
      agentName,
      agentPhone,
      agentEmail,
      serviceType,
      area,
      datePreference,
      dateRangeStart,
      dateRangeEnd,
      notes,
      addedBy,
    } = req.body;

    // Validate required fields
    if (!agentName || !agentPhone || !agentEmail || !serviceType || !area || !datePreference) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check for duplicate active entry with same phone
    const duplicate = await sheets.checkDuplicatePhone(agentPhone);
    if (duplicate) {
      return res.status(409).json({
        error: `An active waitlist entry already exists for this phone number (${duplicate.id}: ${duplicate.agentName})`,
        existingEntry: duplicate,
      });
    }

    const entry = await sheets.addWaitlistEntry({
      agentName,
      agentPhone,
      agentEmail,
      serviceType,
      area,
      datePreference,
      dateRangeStart: datePreference === 'Specific Date Range' ? dateRangeStart : '',
      dateRangeEnd: datePreference === 'Specific Date Range' ? dateRangeEnd : '',
      notes: notes || '',
      addedBy: addedBy || 'Carley',
    });

    // Post to Slack
    const slackMessage = slack.formatNewEntry({
      agentName,
      serviceType,
      area,
      datePreference,
      addedBy: addedBy || 'Carley',
    });
    await slack.postToSlack(slackMessage);

    res.json({ success: true, entry });
  } catch (err) {
    console.error('[Intake] Error:', err.message);
    res.status(500).json({ error: 'Failed to add waitlist entry' });
  }
});

module.exports = router;
