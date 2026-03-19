const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'webhooks.json');

function ensureLogFile() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '[]');
  }
}

function logWebhook(payload) {
  ensureLogFile();
  try {
    const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    logs.push({
      timestamp: new Date().toISOString(),
      payload,
    });
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Failed to log webhook:', err.message);
  }
}

function getLogs() {
  ensureLogFile();
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  } catch {
    return [];
  }
}

module.exports = { logWebhook, getLogs };
