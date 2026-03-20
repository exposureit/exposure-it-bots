const express = require('express');
const sheets = require('../services/sheets');
const slack = require('../services/slack');
const expiration = require('../services/expiration');

const router = express.Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'exposureit2026';

// Simple password check middleware
function requireAuth(req, res, next) {
  // Check query param, cookie, or basic auth
  const pw = req.query.pw || req.cookies?.admin_pw;

  if (pw === ADMIN_PASSWORD) {
    return next();
  }

  // Check basic auth header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [, password] = decoded.split(':');
    if (password === ADMIN_PASSWORD) {
      return next();
    }
  }

  // Show login form
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login — Exposure It</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .login { background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 320px; text-align: center; }
    h1 { font-size: 20px; margin-bottom: 20px; }
    input { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 12px; }
    button { width: 100%; padding: 10px; background: #252525; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="login">
    <h1>Waitlist Admin</h1>
    <form method="GET">
      <input type="password" name="pw" placeholder="Password" autofocus>
      <button type="submit">Log In</button>
    </form>
  </div>
</body>
</html>`);
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const entries = await sheets.getActiveWaitlistEntries();
    const activeEvents = expiration.getActiveEvents();
    const recentActivity = slack.getRecentActivity(10);

    // Stats
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

    const activeCount = entries.filter((e) => e.status === 'Active').length;
    const claimedToday = entries.filter((e) => e.status === 'Claimed' && e.lastNotified && e.lastNotified.startsWith(todayStr.split('/')[0])).length;

    // Source breakdown
    const bySource = {};
    entries.filter((e) => e.status === 'Active').forEach((e) => {
      bySource[e.source || 'Unknown'] = (bySource[e.source || 'Unknown'] || 0) + 1;
    });

    // Service breakdown
    const byService = {};
    entries.filter((e) => e.status === 'Active').forEach((e) => {
      byService[e.serviceType || 'Unknown'] = (byService[e.serviceType || 'Unknown'] || 0) + 1;
    });

    // Build HTML
    const statsHtml = `
      <div class="stat-card"><div class="stat-num">${activeCount}</div><div class="stat-label">Active Entries</div></div>
      <div class="stat-card"><div class="stat-num">${entries.filter((e) => e.status === 'Claimed').length}</div><div class="stat-label">Total Claimed</div></div>
      <div class="stat-card"><div class="stat-num">${activeEvents.length}</div><div class="stat-label">Open Slots Now</div></div>
      <div class="stat-card"><div class="stat-num">${entries.filter((e) => e.status === 'Removed (Self)').length}</div><div class="stat-label">Self-Removed</div></div>
    `;

    const sourceRows = Object.entries(bySource).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    const serviceRows = Object.entries(byService).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');

    const activityRows = recentActivity.map((a) => {
      const t = new Date(a.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
      const msg = a.message.replace(/\*/g, '');
      return `<tr><td class="time">${t}</td><td>${msg}</td></tr>`;
    }).join('');

    const pendingRows = activeEvents.map((e) => {
      const mins = Math.ceil(e.timeRemaining / 60000);
      return `<tr><td>${e.details.shootDate}</td><td>${e.details.shootTime}</td><td>${e.details.duration}m</td><td>${mins} min</td><td>${e.notifiedAgents.length}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="empty">No open slots</td></tr>';

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Waitlist Admin — Exposure It</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width: 1000px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #666; margin-bottom: 24px; font-size: 14px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: #fff; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .stat-num { font-size: 32px; font-weight: 700; color: #252525; }
    .stat-label { font-size: 13px; color: #888; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
    .card { background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card h2 { font-size: 15px; margin-bottom: 12px; color: #252525; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #f0f0f0; }
    th { font-weight: 600; color: #666; font-size: 11px; text-transform: uppercase; }
    .time { color: #888; white-space: nowrap; }
    .empty { color: #aaa; text-align: center; padding: 20px; }
    @media (max-width: 700px) { .stats { grid-template-columns: 1fr 1fr; } .grid { grid-template-columns: 1fr; } }
  </style>
  <meta http-equiv="refresh" content="60">
</head>
<body>
  <div class="container">
    <h1>Waitlist Dashboard</h1>
    <p class="subtitle">Exposure It Waitlist Automation — Admin View</p>

    <div class="stats">${statsHtml}</div>

    <div class="grid">
      <div class="card">
        <h2>Signups by Source</h2>
        <table><thead><tr><th>Source</th><th>Count</th></tr></thead><tbody>${sourceRows || '<tr><td colspan="2" class="empty">No data</td></tr>'}</tbody></table>
      </div>
      <div class="card">
        <h2>Active by Service</h2>
        <table><thead><tr><th>Service</th><th>Count</th></tr></thead><tbody>${serviceRows || '<tr><td colspan="2" class="empty">No data</td></tr>'}</tbody></table>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <h2>Pending Expirations</h2>
      <table><thead><tr><th>Date</th><th>Time</th><th>Duration</th><th>Expires In</th><th>Notified</th></tr></thead><tbody>${pendingRows}</tbody></table>
    </div>

    <div class="card">
      <h2>Recent Activity</h2>
      <table><thead><tr><th>Time</th><th>Event</th></tr></thead><tbody>${activityRows || '<tr><td colspan="2" class="empty">No recent activity</td></tr>'}</tbody></table>
    </div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[Admin] Error:', err);
    res.status(500).send('Dashboard error: ' + err.message);
  }
});

module.exports = router;
