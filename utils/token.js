const crypto = require('crypto');

const TOKEN_SECRET = process.env.JWT_SECRET || process.env.SPIRO_WEBHOOK_SECRET || 'exposure-it-waitlist-secret';

function generateToken(payload) {
  const data = JSON.stringify({ ...payload, created: Date.now() });
  const encoded = Buffer.from(data).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString());
  } catch {
    return null;
  }
}

// Claim token: includes waitlistId + cancellationId
function generateClaimToken(waitlistId, cancellationId) {
  return generateToken({ type: 'claim', waitlistId, cancellationId });
}

function verifyClaimToken(token) {
  const data = verifyToken(token);
  if (!data || data.type !== 'claim') return null;
  return data;
}

// Removal token: includes waitlistId
function generateRemovalToken(waitlistId) {
  return generateToken({ type: 'remove', waitlistId });
}

function verifyRemovalToken(token) {
  const data = verifyToken(token);
  if (!data || data.type !== 'remove') return null;
  return data;
}

module.exports = {
  generateClaimToken,
  verifyClaimToken,
  generateRemovalToken,
  verifyRemovalToken,
};
