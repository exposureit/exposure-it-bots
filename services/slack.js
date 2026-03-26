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

async function postBlocksToSlack(blocks, text) {
  if (!SLACK_WEBHOOK_URL) {
    console.log('[Slack]', text || JSON.stringify(blocks, null, 2));
    return;
  }

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text || '', blocks }),
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

function formatCancellationAlert(cancellation, matches) {
  const header = `:rotating_light: *Cancellation Alert*`;
  const slotInfo = [
    `*Date:* ${cancellation.shootDate}`,
    `*Time:* ${cancellation.shootTime}`,
    `*Duration:* ${cancellation.duration} min`,
    cancellation.cancelledBy ? `*Cancelled by:* ${cancellation.cancelledBy}` : '',
  ].filter(Boolean).join('\n');

  if (matches.length === 0) {
    return [
      header,
      slotInfo,
      '',
      '_No matching clients on the waitlist for this slot._',
    ].join('\n');
  }

  const matchList = matches.map((m, i) => {
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

  return [
    header,
    slotInfo,
    '',
    `:white_check_mark: *${matches.length} waitlist match${matches.length === 1 ? '' : 'es'} found:*`,
    '',
    ...matchList,
  ].join('\n');
}

function formatCancellationReceived(details) {
  return `:calendar: *Cancellation received:* ${details.shootDate} at ${details.shootTime} (${details.duration} min) — ${details.cancelledBy || 'Unknown'}`;
}

module.exports = {
  postToSlack,
  postBlocksToSlack,
  formatCancellationAlert,
  formatCancellationReceived,
};
