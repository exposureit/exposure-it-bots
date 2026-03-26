const sheets = require('./sheets');

/**
 * Find waitlist clients that could fit a cancellation slot.
 *
 * Matching logic:
 * 1. Status = "On Waitlist"
 * 2. Cancellation date is before their "Wants Before Date" (or no date set = always matches)
 * 3. Client's service duration fits within the cancellation slot duration
 *
 * Returns all matches sorted by date added (oldest first / FIFO).
 */
async function findMatches(cancellation) {
  const entries = await sheets.getActiveWaitlistEntries();
  const slotDuration = cancellation.duration || 999;
  const slotDate = parseDate(cancellation.shootDate);

  const matches = [];

  for (const entry of entries) {
    // Check duration fit: client's service must fit within the open slot
    if (entry.duration > 0 && entry.duration > slotDuration) {
      continue;
    }

    // Check date fit: cancellation date should be before their "wants before" date
    if (entry.wantsBeforeDate && slotDate) {
      const wantsBefore = parseDate(entry.wantsBeforeDate);
      if (wantsBefore && slotDate > wantsBefore) {
        continue;
      }
    }
    // If no "wants before" date set, they match any date (like "ASAP" / "Next Available")

    matches.push(entry);
  }

  return matches;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

module.exports = { findMatches };
