const slack = require('./slack');

// In-memory store for active cancellation events
// Key: cancellationId, Value: { details, claimedBy, tokens, notifiedAgents, expiresAt }
const activeCancellations = new Map();

const EXPIRATION_MS = 2 * 60 * 60 * 1000; // 2 hours

function createCancellationEvent(cancellationId, details, notifiedAgents, tokens) {
  activeCancellations.set(cancellationId, {
    details,
    claimedBy: null,
    tokens,
    notifiedAgents,
    expiresAt: Date.now() + EXPIRATION_MS,
    expired: false,
  });
}

function getCancellationEvent(cancellationId) {
  return activeCancellations.get(cancellationId) || null;
}

function markClaimed(cancellationId, agentId) {
  const event = activeCancellations.get(cancellationId);
  if (event) {
    event.claimedBy = agentId;
  }
}

function isClaimed(cancellationId) {
  const event = activeCancellations.get(cancellationId);
  return event ? event.claimedBy !== null : false;
}

function isExpired(cancellationId) {
  const event = activeCancellations.get(cancellationId);
  if (!event) return true;
  return Date.now() > event.expiresAt;
}

// Check for expired unclaimed slots every 60 seconds
function startExpirationChecker() {
  setInterval(async () => {
    for (const [id, event] of activeCancellations.entries()) {
      if (!event.claimedBy && !event.expired && Date.now() > event.expiresAt) {
        event.expired = true;
        console.log(`[Expiration] Slot ${id} expired without being claimed`);
        const message = slack.formatSlotExpired(event.details);
        await slack.postToSlack(message);
      }
    }
  }, 60 * 1000);
}

module.exports = {
  createCancellationEvent,
  getCancellationEvent,
  markClaimed,
  isClaimed,
  isExpired,
  startExpirationChecker,
};
