const crypto = require('crypto');

const TOKEN_SECRET = process.env.SPIRO_WEBHOOK_SECRET || 'exposure-it-waitlist-secret';

function generateClaimToken(waitlistId, cancellationId) {
  const payload = JSON.stringify({ waitlistId, cancellationId, created: Date.now() });
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyClaimToken(token) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    return payload;
  } catch {
    return null;
  }
}

module.exports = { generateClaimToken, verifyClaimToken };
