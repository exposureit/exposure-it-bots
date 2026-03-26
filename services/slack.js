const fetch = require('node-fetch');

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function postToSlack(text) {
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

// ============================================================
// Notification formatters for Carley
// ============================================================

function formatMatchList(matches) {
  if (matches.length === 0) {
    return '_No matching clients on the waitlist for this slot._';
  }

  const header = `:white_check_mark: *${matches.length} waitlist match${matches.length === 1 ? '' : 'es'} found:*`;

  const list = matches.map((m, i) => {
    const lines = [
      `*${i + 1}. ${m.clientName}*`,
      `    Service: ${m.servicePackage} (${m.duration} min)`,
      `    Timing: ${m.preferredTiming}`,
      `    Location: ${m.location}`,
    ];
    if (m.photographerPreference) {
      lines.push(`    Photographer: ${m.photographerPreference}`);
    }
    if (m.notes) {
      lines.push(`    Notes: ${m.notes}`);
    }
    return lines.join('\n');
  });

  return [header, '', ...list].join('\n');
}

function formatCancellationAlert(details, matches) {
  const slotInfo = [
    `:rotating_light: *Cancellation*`,
    `*Client:* ${details.clientName || 'Unknown'}`,
    `*Service:* ${details.servicePackage || 'Unknown'}`,
    `*Date:* ${details.shootDate} at ${details.shootTime}`,
    `*Duration:* ${details.duration} min`,
    details.location ? `*Location:* ${details.location}` : '',
  ].filter(Boolean).join('\n');

  return [slotInfo, '', formatMatchList(matches)].join('\n');
}

function formatRescheduleAlert(details, matches) {
  const slotInfo = [
    `:calendar: *Reschedule*`,
    `*Client:* ${details.clientName || 'Unknown'}`,
    `*Service:* ${details.servicePackage || 'Unknown'}`,
    `*Original:* ${details.originalDate} at ${details.originalTime}`,
    details.newDate ? `*New:* ${details.newDate} at ${details.newTime}` : '',
    `*Duration:* ${details.duration} min`,
    details.location ? `*Location:* ${details.location}` : '',
  ].filter(Boolean).join('\n');

  return [slotInfo, '', formatMatchList(matches)].join('\n');
}

function formatNewOrder(details) {
  return [
    `:new: *New Order*`,
    `*Client:* ${details.clientName || 'Unknown'}`,
    `*Service:* ${details.servicePackage || 'Unknown'}`,
    `*Date:* ${details.shootDate} at ${details.shootTime}`,
    `*Duration:* ${details.duration} min`,
    details.location ? `*Location:* ${details.location}` : '',
  ].filter(Boolean).join('\n');
}

module.exports = {
  postToSlack,
  formatCancellationAlert,
  formatRescheduleAlert,
  formatNewOrder,
};
