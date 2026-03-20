const slack = require('./slack');
const sheets = require('./sheets');

// In-memory store for active cancellation events
const activeCancellations = new Map();

const CLAIM_EXPIRY_MINUTES = parseInt(process.env.CLAIM_EXPIRY_MINUTES || '30', 10);
const EXPIRATION_MS = CLAIM_EXPIRY_MINUTES * 60 * 1000;

function createCancellationEvent(cancellationId, details, notifiedAgents, tokens, eventId) {
  activeCancellations.set(cancellationId, {
    details,
    eventId, // Google Sheet Cancellation Log event ID
    claimedBy: null,
    tokens,
    notifiedAgents,
    expiresAt: Date.now() + EXPIRATION_MS,
    expired: false,
    filledExternally: false,
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

function markFilledExternally(cancellationId) {
  const event = activeCancellations.get(cancellationId);
  if (event) {
    event.filledExternally = true;
  }
}

function isClaimed(cancellationId) {
  const event = activeCancellations.get(cancellationId);
  return event ? event.claimedBy !== null : false;
}

function isFilledExternally(cancellationId) {
  const event = activeCancellations.get(cancellationId);
  return event ? event.filledExternally : false;
}

function isExpired(cancellationId) {
  const event = activeCancellations.get(cancellationId);
  if (!event) return true;
  return Date.now() > event.expiresAt || event.expired;
}

function isSlotUnavailable(cancellationId) {
  return isClaimed(cancellationId) || isFilledExternally(cancellationId) || isExpired(cancellationId);
}

function getTimeRemaining(cancellationId) {
  const event = activeCancellations.get(cancellationId);
  if (!event) return 0;
  return Math.max(0, event.expiresAt - Date.now());
}

/**
 * Find open cancellation events that match a new booking's time slot.
 * Used by the "Order Created" webhook to silently fill slots.
 */
function findOpenSlotsByTime(appointmentDate, duration) {
  const results = [];
  const bookingStart = new Date(appointmentDate).getTime();
  const bookingEnd = bookingStart + (duration || 60) * 60 * 1000;

  for (const [id, event] of activeCancellations.entries()) {
    if (event.claimedBy || event.expired || event.filledExternally) continue;

    // Compare dates - check if the appointment dates match
    const slotDate = event.details.shootDate;
    const bookingDate = appointmentDate.split('T')[0];

    if (slotDate === bookingDate || slotDate === appointmentDate) {
      results.push({ cancellationId: id, event });
    }
  }

  return results;
}

// Get all active (open) events for admin dashboard
function getActiveEvents() {
  const events = [];
  for (const [id, event] of activeCancellations.entries()) {
    if (!event.claimedBy && !event.expired && !event.filledExternally) {
      events.push({
        cancellationId: id,
        ...event,
        timeRemaining: Math.max(0, event.expiresAt - Date.now()),
      });
    }
  }
  return events;
}

function getExpiryMinutes() {
  return CLAIM_EXPIRY_MINUTES;
}

// Check for expired unclaimed slots
function startExpirationChecker() {
  setInterval(async () => {
    for (const [id, event] of activeCancellations.entries()) {
      if (!event.claimedBy && !event.expired && !event.filledExternally && Date.now() > event.expiresAt) {
        event.expired = true;
        console.log(`[Expiration] Slot ${id} expired without being claimed`);

        // Update Google Sheet
        try {
          if (event.eventId) {
            await sheets.updateCancellationStatus(event.eventId, 'Expired', '');
          }
        } catch (err) {
          console.error('[Expiration] Failed to update sheet:', err.message);
        }

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
  markFilledExternally,
  isClaimed,
  isFilledExternally,
  isExpired,
  isSlotUnavailable,
  getTimeRemaining,
  findOpenSlotsByTime,
  getActiveEvents,
  getExpiryMinutes,
  startExpirationChecker,
};
