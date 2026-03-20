const express = require('express');
const router = express.Router();

// Legacy routes — redirect to new waitlist signup
router.get('/add', (req, res) => {
  res.redirect('/waitlist');
});

router.post('/add', (req, res) => {
  res.redirect(307, '/waitlist/signup');
});

module.exports = router;
