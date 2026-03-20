const sheets = require('./sheets');

function isDateInRange(targetDate, rangeStart, rangeEnd) {
  if (!rangeStart || !rangeEnd) return false;
  const target = new Date(targetDate);
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  // Set to start of day for comparison
  target.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return target >= start && target <= end;
}

/**
 * Find matching waitlist entries for a cancellation slot.
 * Returns { matches, skipped } where skipped includes reasons.
 *
 * Filters (in order per spec):
 * 1. Status = Active
 * 2. Date range check
 * 3. Duration fit (agent's adjusted duration <= slot duration)
 * 4. Sort by Date Added (FIFO)
 */
async function findMatches(cancellation) {
  const entries = await sheets.getActiveWaitlistEntries();
  const slotDuration = cancellation.duration || 999; // minutes

  const matches = [];
  const skipped = [];

  for (const entry of entries) {
    // Filter 1: Status
    if (entry.status !== 'Active') continue;

    // Filter 2: Date range
    if (entry.timing === 'Specific Dates') {
      if (!isDateInRange(cancellation.shootDate, entry.dateRangeStart, entry.dateRangeEnd)) {
        skipped.push({
          entry,
          reason: 'date',
          detail: `date outside range (${entry.dateRangeStart} - ${entry.dateRangeEnd})`,
        });
        continue;
      }
    }
    // "Next Available" always passes date filter

    // Filter 3: Duration fit
    const agentDuration = entry.adjustedDuration || entry.baseDuration || 0;
    if (agentDuration > 0 && agentDuration > slotDuration) {
      skipped.push({
        entry,
        reason: 'duration',
        detail: `needs ${agentDuration}m, slot is ${slotDuration}m`,
      });
      continue;
    }

    matches.push(entry);
  }

  // Filter 4: Sort by dateAdded (oldest first = FIFO)
  matches.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));

  return { matches, skipped };
}

/**
 * Filter 5: Multi-listing consolidation.
 * Groups matches by phone number for consolidated SMS.
 * Returns Map<phone, { agent, matchingEntries[], skippedEntries[] }>
 */
function consolidateByAgent(matches, skipped) {
  const byPhone = new Map();

  for (const entry of matches) {
    const phone = entry.agentPhone;
    if (!byPhone.has(phone)) {
      byPhone.set(phone, {
        agent: { agentName: entry.agentName, agentPhone: entry.agentPhone, agentEmail: entry.agentEmail },
        matchingEntries: [],
        skippedEntries: [],
      });
    }
    byPhone.get(phone).matchingEntries.push(entry);
  }

  // Add skipped entries for agents who have at least one match
  for (const skip of skipped) {
    const phone = skip.entry.agentPhone;
    if (byPhone.has(phone)) {
      byPhone.get(phone).skippedEntries.push(skip);
    }
  }

  return byPhone;
}

module.exports = { findMatches, consolidateByAgent };
