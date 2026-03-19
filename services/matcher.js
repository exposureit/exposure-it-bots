const sheets = require('./sheets');

function isDateInRange(targetDate, rangeStart, rangeEnd) {
  if (!rangeStart || !rangeEnd) return false;
  const target = new Date(targetDate);
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  return target >= start && target <= end;
}

function serviceTypeMatches(agentService, cancelledService) {
  if (agentService === 'Any') return true;
  if (cancelledService === 'Any') return true;
  return agentService.toLowerCase() === cancelledService.toLowerCase();
}

function areaMatches(agentArea, cancelledArea) {
  if (agentArea === 'Either') return true;
  if (cancelledArea === 'Either') return true;
  return agentArea.toLowerCase() === cancelledArea.toLowerCase();
}

async function findMatches(cancellation) {
  const entries = await sheets.getActiveWaitlistEntries();

  const matches = entries.filter((entry) => {
    if (entry.status !== 'Active') return false;
    if (!serviceTypeMatches(entry.serviceType, cancellation.serviceType)) return false;
    if (!areaMatches(entry.area, cancellation.area)) return false;

    // Check date preference
    if (entry.datePreference === 'ASAP' || entry.datePreference === 'Flexible') {
      return true;
    }

    if (entry.datePreference === 'Specific Date Range') {
      return isDateInRange(cancellation.date, entry.dateRangeStart, entry.dateRangeEnd);
    }

    return true; // Default to matching if date preference is unclear
  });

  // Sort by dateAdded (oldest first — FIFO)
  matches.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));

  return matches;
}

module.exports = { findMatches };
