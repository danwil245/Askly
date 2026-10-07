import crypto from 'node:crypto';

/** Generate a cryptographically random host token (opaque, URL-safe). */
export function generateHostToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/** sha256 hex of the given string. Used to store host tokens without the raw value. */
export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/**
 * Constant-time comparison of a raw token against a stored hash.
 * @param {string} rawToken
 * @param {string} storedHash
 */
export function verifyToken(rawToken, storedHash) {
  if (!rawToken || !storedHash) return false;
  const a = Buffer.from(sha256(rawToken));
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
