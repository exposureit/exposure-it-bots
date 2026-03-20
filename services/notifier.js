const fetch = require('node-fetch');
const nodemailer = require('nodemailer');

const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY;
const OPENPHONE_PHONE_ID = process.env.OPENPHONE_PHONE_ID || process.env.OPENPHONE_FROM_NUMBER_ID;
const BASE_URL = process.env.BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000';

function getEmailTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function firstName(fullName) {
  return (fullName || '').split(' ')[0] || 'there';
}

function formatDay(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' });
  } catch {
    return '';
  }
}

async function sendSMS(to, message, retries = 3) {
  if (!OPENPHONE_API_KEY || !OPENPHONE_PHONE_ID) {
    console.log(`[SMS] Would send to ${to}:`, message);
    return;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: {
          Authorization: OPENPHONE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
          from: OPENPHONE_PHONE_ID,
          to: [to],
        }),
      });

      if (res.ok) return;

      if (res.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
        continue;
      }

      console.error(`[SMS] Failed to send to ${to}:`, res.status, await res.text());
      return;
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
        continue;
      }
      console.error(`[SMS] Error sending to ${to}:`, err.message);
    }
  }
}

async function sendEmail(to, subject, htmlBody) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`[Email] Would send to ${to}:`, subject);
    return;
  }

  try {
    const transporter = getEmailTransporter();
    await transporter.sendMail({
      from: `"Exposure It Team" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: htmlBody,
    });
  } catch (err) {
    console.error(`[Email] Error sending to ${to}:`, err.message);
  }
}

// ============================================================
// 6.1 Waitlist Confirmation (after signup)
// ============================================================
async function sendWaitlistConfirmation(entry, removalToken) {
  const name = firstName(entry.agentName);
  const timing = entry.timing === 'Specific Dates'
    ? `Specific: ${entry.dateRangeStart} - ${entry.dateRangeEnd}`
    : entry.timing;
  const duration = entry.adjustedDuration || entry.baseDuration || '';

  const sms = [
    `Hi ${name}! You are on the Exposure It waitlist.`,
    '',
    `Service: ${entry.serviceType} (${duration} min)`,
    `Address: ${entry.listingAddress}`,
    `Timing: ${timing}`,
    '',
    `We will text you the moment a matching slot opens. First to claim wins!`,
    '',
    `Need off the list?`,
    `${BASE_URL}/remove/${removalToken}`,
  ].join('\n');

  const html = `
    <p>Hi ${name},</p>
    <p>You're on the Exposure It waitlist!</p>
    <p>
      <strong>Service:</strong> ${entry.serviceType} (${duration} min)<br>
      <strong>Address:</strong> ${entry.listingAddress}<br>
      <strong>Timing:</strong> ${timing}
    </p>
    <p>We'll text you the moment a matching slot opens. First to claim wins!</p>
    <p style="font-size:13px;color:#666;">Need off the list? <a href="${BASE_URL}/remove/${removalToken}">Remove yourself</a></p>
    <p>- Exposure It Team</p>
  `;

  await Promise.all([
    sendSMS(entry.agentPhone, sms),
    sendEmail(entry.agentEmail, "You're on the Exposure It waitlist!", html),
  ]);
}

// ============================================================
// 6.2 Slot Available (single listing)
// ============================================================
async function notifySingleListing(agent, entry, cancellation, claimToken, removalToken) {
  const name = firstName(agent.agentName);
  const day = formatDay(cancellation.shootDate);
  const duration = entry.adjustedDuration || entry.baseDuration || '';
  const expiry = parseInt(process.env.CLAIM_EXPIRY_MINUTES || '30', 10);

  const sms = [
    `${name}, a shoot just opened up!`,
    '',
    `${entry.serviceType} | ${duration} min`,
    `${day}, ${cancellation.shootDate} | ${cancellation.shootTime}`,
    '',
    `Claim it before someone else does:`,
    `${BASE_URL}/claim/${claimToken}`,
    '',
    `This link expires in ${expiry} min.`,
    '',
    `Not interested? Remove yourself:`,
    `${BASE_URL}/remove/${removalToken}`,
  ].join('\n');

  const html = `
    <p>${name}, a shoot just opened up!</p>
    <p><strong>${entry.serviceType}</strong> | ${duration} min<br>
    ${day}, ${cancellation.shootDate} | ${cancellation.shootTime}</p>
    <p><a href="${BASE_URL}/claim/${claimToken}" style="display:inline-block;padding:14px 28px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">Claim This Slot</a></p>
    <p style="font-size:13px;color:#666;">This link expires in ${expiry} min.</p>
    <p style="font-size:13px;color:#666;">Not interested? <a href="${BASE_URL}/remove/${removalToken}">Remove yourself from the waitlist</a></p>
  `;

  await Promise.all([
    sendSMS(agent.agentPhone, sms),
    sendEmail(agent.agentEmail, 'A shoot just opened up — claim it now!', html),
  ]);
}

// ============================================================
// 6.3 Slot Available (multi-listing, consolidated)
// ============================================================
async function notifyMultiListing(agent, matchingEntries, skippedEntries, cancellation, claimTokens, removalToken) {
  const name = firstName(agent.agentName);
  const day = formatDay(cancellation.shootDate);
  const expiry = parseInt(process.env.CLAIM_EXPIRY_MINUTES || '30', 10);

  let smsLines = [
    `${name}, a shoot just opened up!`,
    '',
    `Slot: ${day}, ${cancellation.shootDate} | ${cancellation.shootTime} (${cancellation.duration} min)`,
    '',
    `This matches ${matchingEntries.length} of your listings:`,
    '',
  ];

  let counter = 1;
  for (const entry of matchingEntries) {
    const token = claimTokens[entry.id];
    smsLines.push(`${counter}. ${entry.serviceType} | ${entry.listingAddress}`);
    smsLines.push(`   Claim: ${BASE_URL}/claim/${token}`);
    smsLines.push('');
    counter++;
  }

  for (const skip of skippedEntries) {
    smsLines.push(`${counter}. ${skip.entry.serviceType} | ${skip.entry.listingAddress}`);
    smsLines.push(`   (skipped - ${skip.detail})`);
    smsLines.push('');
    counter++;
  }

  smsLines.push(`Links expire in ${expiry} min.`);
  smsLines.push('');
  smsLines.push(`Remove from waitlist:`);
  smsLines.push(`${BASE_URL}/remove/${removalToken}`);

  const sms = smsLines.join('\n');

  // Build HTML version
  let htmlListings = '';
  counter = 1;
  for (const entry of matchingEntries) {
    const token = claimTokens[entry.id];
    htmlListings += `<li style="margin-bottom:12px;"><strong>${entry.serviceType}</strong> | ${entry.listingAddress}<br><a href="${BASE_URL}/claim/${token}" style="color:#16a34a;font-weight:bold;">Claim this slot</a></li>`;
    counter++;
  }
  for (const skip of skippedEntries) {
    htmlListings += `<li style="margin-bottom:12px;color:#666;"><strong>${skip.entry.serviceType}</strong> | ${skip.entry.listingAddress}<br><em>(skipped - ${skip.detail})</em></li>`;
  }

  const html = `
    <p>${name}, a shoot just opened up!</p>
    <p><strong>Slot:</strong> ${day}, ${cancellation.shootDate} | ${cancellation.shootTime} (${cancellation.duration} min)</p>
    <p>This matches ${matchingEntries.length} of your listings:</p>
    <ol>${htmlListings}</ol>
    <p style="font-size:13px;color:#666;">Links expire in ${expiry} min.</p>
    <p style="font-size:13px;color:#666;">Not interested? <a href="${BASE_URL}/remove/${removalToken}">Remove from waitlist</a></p>
  `;

  await Promise.all([
    sendSMS(agent.agentPhone, sms),
    sendEmail(agent.agentEmail, 'A shoot just opened up — claim it now!', html),
  ]);
}

// ============================================================
// 6.4 Claim Confirmation
// ============================================================
async function notifyClaimConfirmation(agent, entry, cancellation) {
  const name = firstName(agent.agentName);
  const day = formatDay(cancellation.shootDate);
  const duration = entry.adjustedDuration || entry.baseDuration || '';

  const sms = [
    `You have claimed this spot!`,
    '',
    `Service: ${entry.serviceType} (${duration} min)`,
    `Date: ${day}, ${cancellation.shootDate} at ${cancellation.shootTime}`,
    `Address: ${entry.listingAddress}`,
    '',
    `The Exposure It team will book this in officially and send you a booking confirmation email.`,
    '',
    `NOTE: Your booking is not confirmed until you receive an official booking confirmation email.`,
    '',
    `Questions? Call us at 412-709-5227`,
  ].join('\n');

  const html = `
    <p>Hi ${name},</p>
    <p><strong>You have claimed this spot!</strong></p>
    <p>
      <strong>Service:</strong> ${entry.serviceType} (${duration} min)<br>
      <strong>Date:</strong> ${day}, ${cancellation.shootDate} at ${cancellation.shootTime}<br>
      <strong>Address:</strong> ${entry.listingAddress}
    </p>
    <p>The Exposure It team will book this in officially and send you a booking confirmation email.</p>
    <p><strong>NOTE:</strong> Your booking is not confirmed until you receive an official booking confirmation email.</p>
    <p>Questions? Call us at <a href="tel:4127095227">412-709-5227</a></p>
  `;

  await Promise.all([
    sendSMS(agent.agentPhone, sms),
    sendEmail(agent.agentEmail, "You've claimed a spot — Exposure It", html),
  ]);
}

// ============================================================
// 6.5 Removal Confirmation
// ============================================================
async function notifyRemovalConfirmation(entry) {
  const name = firstName(entry.agentName);

  const sms = [
    `You have been removed from the Exposure It waitlist for:`,
    '',
    `${entry.serviceType} | ${entry.listingAddress}`,
    '',
    `You will not receive notifications for this listing.`,
    '',
    `Changed your mind? Re-join here:`,
    `${BASE_URL}/waitlist`,
  ].join('\n');

  const html = `
    <p>Hi ${name},</p>
    <p>You've been removed from the Exposure It waitlist for:</p>
    <p><strong>${entry.serviceType}</strong> | ${entry.listingAddress}</p>
    <p>You will not receive notifications for this listing.</p>
    <p>Changed your mind? <a href="${BASE_URL}/waitlist">Re-join the waitlist</a></p>
    <p>- Exposure It Team</p>
  `;

  await Promise.all([
    sendSMS(entry.agentPhone, sms),
    sendEmail(entry.agentEmail, 'Removed from Exposure It waitlist', html),
  ]);
}

// Notify other agents that slot was taken (no change to their waitlist status)
async function notifyAgentsSlotTaken(agents, cancellation) {
  const promises = agents.map((agent) => {
    const name = firstName(agent.agentName);
    const sms = `Heads up — that ${cancellation.shootDate} slot was just claimed. You're still on our waitlist and we'll notify you when the next opening comes up!`;

    const html = `
      <p>Hi ${name},</p>
      <p>The ${cancellation.shootDate} at ${cancellation.shootTime} slot was just claimed by another agent.</p>
      <p>You're still on our waitlist and we'll notify you when the next opening comes up!</p>
      <p>- Exposure It Team</p>
    `;

    return Promise.all([
      sendSMS(agent.agentPhone, sms),
      sendEmail(agent.agentEmail, 'Slot update — Exposure It', html),
    ]);
  });

  await Promise.all(promises);
}

module.exports = {
  sendWaitlistConfirmation,
  notifySingleListing,
  notifyMultiListing,
  notifyClaimConfirmation,
  notifyRemovalConfirmation,
  notifyAgentsSlotTaken,
};
