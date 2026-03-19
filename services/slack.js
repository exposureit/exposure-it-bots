const fetch = require('node-fetch');

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function postToSlack(text) {
  if (!SLACK_WEBHOOK_URL) {
    console.log('[Slack] No webhook URL configured. Message:', text);
    return;
  }

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      console.error('[Slack] Failed to post message:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Slack] Error posting message:', err.message);
  }
}

function formatNewEntry(entry) {
  return [
    '*NEW WAITLIST ENTRY*',
    `📋 ${entry.agentName} added to waitlist`,
    `Service: ${entry.serviceType} | Area: ${entry.area} | Preference: ${entry.datePreference}`,
    `Added by: ${entry.addedBy}`,
  ].join('\n');
}

function formatCancellation(details) {
  return [
    '*CANCELLATION DETECTED*',
    `🔔 Shoot cancelled: ${details.date} at ${details.time}`,
    `Service: ${details.serviceType} | Area: ${details.area}`,
    'Searching waitlist for matches...',
  ].join('\n');
}

function formatNotificationsSent(details, agentNames) {
  return [
    '*NOTIFICATIONS SENT*',
    `📤 Notified ${agentNames.length} agents about the ${details.date} ${details.time} opening`,
    `Agents: ${agentNames.join(', ')}`,
    'Claim link expires in 2 hours',
  ].join('\n');
}

function formatSlotClaimed(agentName, details) {
  return [
    '*SLOT CLAIMED*',
    `✅ ${agentName} claimed the ${details.date} at ${details.time} slot`,
    `Service: ${details.serviceType} | Area: ${details.area}`,
    'ACTION NEEDED: Book this agent in Spiro',
  ].join('\n');
}

function formatSlotExpired(details) {
  return [
    '*SLOT EXPIRED*',
    `⏰ No one claimed the ${details.date} at ${details.time} slot`,
    `Service: ${details.serviceType} | Area: ${details.area}`,
    'Carley — handle manually if needed',
  ].join('\n');
}

function formatNoMatches(details) {
  return [
    '*NO MATCHES*',
    `⚠️ Cancellation: ${details.date} at ${details.time} — ${details.serviceType} — ${details.area}`,
    'No matching agents on the waitlist',
  ].join('\n');
}

module.exports = {
  postToSlack,
  formatNewEntry,
  formatCancellation,
  formatNotificationsSent,
  formatSlotClaimed,
  formatSlotExpired,
  formatNoMatches,
};
