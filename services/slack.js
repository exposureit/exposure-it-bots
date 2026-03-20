const fetch = require('node-fetch');

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// In-memory activity log for admin dashboard
const activityLog = [];
const MAX_LOG_SIZE = 100;

function logActivity(message) {
  activityLog.unshift({ message, timestamp: new Date().toISOString() });
  if (activityLog.length > MAX_LOG_SIZE) activityLog.length = MAX_LOG_SIZE;
}

function getRecentActivity(count = 10) {
  return activityLog.slice(0, count);
}

async function postToSlack(text) {
  logActivity(text);

  if (!SLACK_WEBHOOK_URL) {
    console.log('[Slack]', text);
    return;
  }

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      console.error('[Slack] Failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Slack] Error:', err.message);
  }
}

// --- Event formatters per spec Section 10 ---

function formatNewSignup(entry) {
  const timing = entry.timing === 'Specific Dates'
    ? `Specific: ${entry.dateRangeStart} - ${entry.dateRangeEnd}`
    : entry.timing;
  return `*NEW SIGNUP:* ${entry.agentName} - ${entry.serviceType} (${entry.adjustedDuration || entry.baseDuration}m, ${entry.squareFootage || '?'}sf) - ${timing} (via ${entry.source})`;
}

function formatInternalAdd(entry) {
  return `*NEW ENTRY:* ${entry.agentName} - ${entry.serviceType} (${entry.adjustedDuration || entry.baseDuration}m) - ${entry.timing} (by Carley)`;
}

function formatCancellation(details) {
  return `*CANCELLATION:* ${details.shootDate}, ${details.shootTime} (${details.duration}m) - ${details.cancelledBy || 'Unknown'}`;
}

function formatNotificationsSent(details, notifiedCount, totalCount, skippedCount) {
  const expiry = parseInt(process.env.CLAIM_EXPIRY_MINUTES || '30', 10);
  return `*NOTIFIED* ${notifiedCount} of ${totalCount} agents (${skippedCount} skipped). Links expire in ${expiry} min.`;
}

function formatAgentSkippedDuration(entry, slotDuration) {
  return `*SKIPPED:* ${entry.agentName} (${entry.serviceType}, ${entry.adjustedDuration}m) - slot only ${slotDuration}m. Not notified.`;
}

function formatAgentSkippedDate(entry) {
  return `*SKIPPED:* ${entry.agentName} (${entry.serviceType}) - date outside range (${entry.dateRangeStart} - ${entry.dateRangeEnd}). Not notified.`;
}

function formatMultiListingConsolidated(agentName, matchCount) {
  return `*MULTI-LISTING:* ${agentName} matched on ${matchCount} entries. Sent 1 consolidated SMS.`;
}

function formatSlotClaimed(agent, details) {
  return `*CLAIMED:* ${agent.agentName} - ${agent.serviceType} (${agent.adjustedDuration || agent.baseDuration}m) - ${details.shootDate}, ${details.shootTime}. Address: ${agent.listingAddress}. ${agent.squareFootage || '?'}sf. Book in Spiro.`;
}

function formatFilledExternally(details) {
  return `*FILLED VIA SPIRO:* ${details.shootDate}, ${details.shootTime} slot booked externally. Claim links silently expired.`;
}

function formatSelfRemoved(entry) {
  return `*SELF-REMOVED:* ${entry.agentName} removed ${entry.id} (${entry.serviceType}, ${entry.listingAddress}).`;
}

function formatSlotExpired(details) {
  return `*EXPIRED:* No claims for ${details.shootDate}, ${details.shootTime} slot after ${parseInt(process.env.CLAIM_EXPIRY_MINUTES || '30', 10)} min.`;
}

function formatNoMatches(details) {
  return `*NO MATCHES:* Cancellation ${details.shootDate}, ${details.shootTime} (${details.duration}m) - no matching agents on the waitlist.`;
}

module.exports = {
  postToSlack,
  getRecentActivity,
  formatNewSignup,
  formatInternalAdd,
  formatCancellation,
  formatNotificationsSent,
  formatAgentSkippedDuration,
  formatAgentSkippedDate,
  formatMultiListingConsolidated,
  formatSlotClaimed,
  formatFilledExternally,
  formatSelfRemoved,
  formatSlotExpired,
  formatNoMatches,
};
