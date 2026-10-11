import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/** Sign a JWT for a user id. Payload is intentionally minimal: { sub }. */
export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

/**
 * Verify a JWT and return its userId, or null if invalid/expired.
 * Never throws — callers treat null as "not authenticated".
 */
export function verifyToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    return payload.sub || null;
  } catch {
    return null;
  }
}
