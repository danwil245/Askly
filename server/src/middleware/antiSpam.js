import rateLimit from 'express-rate-limit';
import { TokenBucket } from './tokenBucket.js';
import { env } from '../config/env.js';
import { appError, ERROR_CODES } from '../utils/errors.js';

const MINUTE = 60_000;

// Socket-level token buckets, one per action. Keyed by clientId AND by IP (both must pass).
export const buckets = {
  question: new TokenBucket({ capacity: env.limits.questionsPerMin, windowMs: MINUTE }),
  upvote: new TokenBucket({ capacity: env.limits.upvotesPerMin, windowMs: MINUTE }),
  vote: new TokenBucket({ capacity: env.limits.votesPerMin, windowMs: MINUTE }),
};

// Sweep idle buckets every 5 minutes (not referenced in tests).
const sweeper = setInterval(() => {
  for (const b of Object.values(buckets)) b.sweep();
}, 5 * MINUTE);
if (sweeper.unref) sweeper.unref();

/**
 * Enforce a socket action's rate limit against both the clientId and the IP.
 * Throws RATE_LIMITED (converted to an ack by withAck).
 */
export function enforceSocketLimit(action, { clientId, ip }) {
  const bucket = buckets[action];
  if (!bucket) return;
  const okClient = bucket.take(`c:${clientId}`);
  const okIp = bucket.take(`i:${ip}`);
  if (!okClient || !okIp) {
    throw appError(ERROR_CODES.RATE_LIMITED, 'Slow down — too many requests');
  }
}

/** For tests: clear all socket buckets. */
export function resetBuckets() {
  for (const b of Object.values(buckets)) b.reset();
}

// REST limiter for room creation (per IP).
export const roomCreateLimiter = rateLimit({
  windowMs: 60 * MINUTE, // 1 hour
  limit: env.limits.roomCreatePerHour,
  standardHeaders: true,
  legacyHeaders: false,
  // Disable in test mode so integration tests aren't throttled.
  skip: () => env.isTest,
  handler: (_req, res) => {
    res
      .status(429)
      .json({ error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many rooms created' } });
  },
});
