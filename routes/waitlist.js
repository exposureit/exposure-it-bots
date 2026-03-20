const express = require('express');
const path = require('path');
const sheets = require('../services/sheets');
const slack = require('../services/slack');
const notifier = require('../services/notifier');
const { generateRemovalToken } = require('../utils/token');
const { getBaseDuration, getAdjustedDuration, getServiceNames } = require('../services/duration');

const router = express.Router();

// Public signup page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'waitlist-signup.html'));
});

// Service list API (for dynamic form)
router.get('/services', (req, res) => {
  const services = getServiceNames().map((name) => ({
    name,
    baseDuration: getBaseDuration(name),
  }));
  res.json(services);
});

// Handle signup submission
router.post('/signup', async (req, res) => {
  try {
    const {
      agentName,
      agentPhone,
      agentEmail,
      listingAddress,
      squareFootage,
      serviceType,
      timing,
      dateRangeStart,
      dateRangeEnd,
      notes,
      addedBy,
      source,
    } = req.body;

    // Validate required fields
    if (!agentName || !agentPhone || !agentEmail || !serviceType || !listingAddress) {
      return res.status(400).json({ error: 'Missing required fields: name, phone, email, service type, and listing address are required.' });
    }

    // Check for duplicate (same phone + same address)
    const duplicate = await sheets.checkDuplicateEntry(agentPhone, listingAddress);
    if (duplicate) {
      return res.status(409).json({
        error: `An active entry already exists for this phone + address (${duplicate.id}).`,
        existingEntry: duplicate,
      });
    }

    // Calculate durations
    const sqFt = parseInt(squareFootage || '0', 10) || 0;
    const baseDuration = getBaseDuration(serviceType);
    const adjustedDuration = getAdjustedDuration(serviceType, sqFt);

    // Determine source from query param or body
    const entrySource = source || req.query.src || 'Website';
    const isInternal = (addedBy || '').toLowerCase() === 'carley' || entrySource === 'Carley';

    const entry = await sheets.addWaitlistEntry({
      agentName,
      agentPhone,
      agentEmail,
      listingAddress,
      squareFootage: sqFt,
      serviceType,
      baseDuration,
      adjustedDuration,
      timing: timing || 'Next Available',
      dateRangeStart: timing === 'Specific Dates' ? dateRangeStart : '',
      dateRangeEnd: timing === 'Specific Dates' ? dateRangeEnd : '',
      notes: notes || '',
      addedBy: addedBy || 'Self-Signup',
      source: entrySource,
    });

    // Post to Slack
    const slackEntry = { ...entry, baseDuration, adjustedDuration, squareFootage: sqFt, timing: timing || 'Next Available', dateRangeStart, dateRangeEnd, source: entrySource };
    if (isInternal) {
      await slack.postToSlack(slack.formatInternalAdd(slackEntry));
    } else {
      await slack.postToSlack(slack.formatNewSignup(slackEntry));
    }

    // Send confirmation SMS + email with removal link
    const removalToken = generateRemovalToken(entry.id);
    await notifier.sendWaitlistConfirmation(
      { ...entry, listingAddress, squareFootage: sqFt, serviceType, baseDuration, adjustedDuration, timing: timing || 'Next Available', dateRangeStart, dateRangeEnd },
      removalToken
    );

    res.json({ success: true, entry });
  } catch (err) {
    console.error('[Waitlist] Error:', err.message);
    res.status(500).json({ error: 'Failed to add waitlist entry' });
  }
});

module.exports = router;
