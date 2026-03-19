const fetch = require('node-fetch');
const nodemailer = require('nodemailer');

const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY;
const OPENPHONE_FROM_NUMBER_ID = process.env.OPENPHONE_FROM_NUMBER_ID;

function getEmailTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function getFirstName(fullName) {
  return (fullName || '').split(' ')[0] || 'there';
}

async function sendSMS(to, message, retries = 3) {
  if (!OPENPHONE_API_KEY || !OPENPHONE_FROM_NUMBER_ID) {
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
          from: OPENPHONE_FROM_NUMBER_ID,
          to: [to],
        }),
      });

      if (res.ok) return;

      if (res.status === 429 && attempt < retries) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`[SMS] Rate limited, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      console.error(`[SMS] Failed to send to ${to}:`, res.status, await res.text());
      return;
    } catch (err) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        await new Promise((r) => setTimeout(r, delay));
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

async function notifyAgentOfOpening(agent, cancellation, claimLink) {
  const firstName = getFirstName(agent.agentName);

  // SMS
  const smsMessage = [
    `Hi ${firstName}! A shoot just opened up at Exposure It.`,
    '',
    `${cancellation.serviceType} — ${cancellation.area}`,
    `${cancellation.date}, ${cancellation.time}`,
    '',
    `Want it? Claim it here before someone else does:`,
    claimLink,
    '',
    `This link expires in 2 hours. First to claim it gets the slot.`,
    '',
    `- Exposure It Team`,
  ].join('\n');

  // Email
  const emailHtml = `
    <p>Hi ${firstName},</p>
    <p>Great news — a slot just opened up that matches what you were looking for.</p>
    <p>
      <strong>Service:</strong> ${cancellation.serviceType}<br>
      <strong>Area:</strong> ${cancellation.area}<br>
      <strong>Date:</strong> ${cancellation.date}<br>
      <strong>Time:</strong> ${cancellation.time}
    </p>
    <p><a href="${claimLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Claim This Slot</a></p>
    <p>This link expires in 2 hours. First to claim it gets the booking.</p>
    <p>Talk soon,<br>Exposure It Team</p>
  `;

  await Promise.all([
    sendSMS(agent.agentPhone, smsMessage),
    sendEmail(
      agent.agentEmail,
      'A shoot just opened up at Exposure It — claim it now',
      emailHtml
    ),
  ]);
}

async function notifyAgentOfClaim(agent, cancellation) {
  const firstName = getFirstName(agent.agentName);

  const smsMessage = `You're booked! ${cancellation.serviceType} on ${cancellation.date} at ${cancellation.time}. The Exposure It team will confirm your booking shortly.`;

  const emailHtml = `
    <p>Hi ${firstName},</p>
    <p>You're booked! Here are your details:</p>
    <p>
      <strong>Service:</strong> ${cancellation.serviceType}<br>
      <strong>Area:</strong> ${cancellation.area}<br>
      <strong>Date:</strong> ${cancellation.date}<br>
      <strong>Time:</strong> ${cancellation.time}
    </p>
    <p>The Exposure It team will confirm your booking shortly.</p>
    <p>Talk soon,<br>Exposure It Team</p>
  `;

  await Promise.all([
    sendSMS(agent.agentPhone, smsMessage),
    sendEmail(agent.agentEmail, "You're booked — Exposure It", emailHtml),
  ]);
}

async function notifyAgentsSlotTaken(agents, cancellation) {
  const promises = agents.map((agent) => {
    const firstName = getFirstName(agent.agentName);
    const smsMessage = `Heads up — that ${cancellation.date} slot was just claimed. You're still on our waitlist and we'll notify you when the next opening comes up!`;

    const emailHtml = `
      <p>Hi ${firstName},</p>
      <p>Heads up — the ${cancellation.serviceType} slot on ${cancellation.date} at ${cancellation.time} was just claimed by another agent.</p>
      <p>You're still on our waitlist and we'll notify you when the next opening comes up!</p>
      <p>Talk soon,<br>Exposure It Team</p>
    `;

    return Promise.all([
      sendSMS(agent.agentPhone, smsMessage),
      sendEmail(agent.agentEmail, 'Slot update — Exposure It', emailHtml),
    ]);
  });

  await Promise.all(promises);
}

module.exports = {
  notifyAgentOfOpening,
  notifyAgentOfClaim,
  notifyAgentsSlotTaken,
};
