/**
 * Anti-Spamming Security: Rate Limiting & Anti-Spam Middleware
 * Action-specific socket buckets (questions, upvotes, poll votes, quiz answers),
 * REST limiters, and per-email failed-login throttling.
 */
import rateLimit from 'express-rate-limit';
import { TokenBucket } from './tokenBucket.js';
import { env } from '../config/env.js';
import { appError, ERROR_CODES } from '../utils/errors.js';

const MINUTE = 60_000;

// Socket-level token buckets, one per action. Keyed by identity AND by IP (both must pass).
export const buckets = {
  question: new TokenBucket({ capacity: env.limits.questionsPerMin, windowMs: MINUTE }),
  upvote: new TokenBucket({ capacity: env.limits.upvotesPerMin, windowMs: MINUTE }),
  vote: new TokenBucket({ capacity: env.limits.votesPerMin, windowMs: MINUTE }),
  quizAnswer: new TokenBucket({ capacity: env.limits.quizAnswersPerMin, windowMs: MINUTE }),
};

// Per-email failed-login counter (in-memory, 15-minute window).
const loginFails = new Map(); // emailLower -> { count, resetAt }
const LOGIN_WINDOW = 15 * MINUTE;

// Sweep idle buckets + stale login-fail entries every 5 minutes.
const sweeper = setInterval(() => {
  for (const b of Object.values(buckets)) b.sweep();
  const now = Date.now();
  for (const [email, entry] of loginFails) {
    if (now > entry.resetAt) loginFails.delete(email);
  }
}, 5 * MINUTE);
if (sweeper.unref) sweeper.unref();

/**
 * Enforce a socket action's rate limit against both the identity key and the IP.
 * Throws RATE_LIMITED (converted to an ack by withAck).
 * @param {string} action  one of the bucket keys
 * @param {{ id: string, ip: string }} ctx  identity key (userId or clientId) + IP
 */
export function enforceSocketLimit(action, { id, clientId, ip }) {
  const bucket = buckets[action];
  if (!bucket) return;
  const key = id ?? clientId; // Phase 2 switches qa/mentor identity to userId
  const okId = bucket.take(`k:${key}`);
  const okIp = bucket.take(`i:${ip}`);
  if (!okId || !okIp) {
    throw appError(ERROR_CODES.RATE_LIMITED, 'Slow down — too many requests');
  }
}

/** For tests: clear all socket buckets and login-fail counters. */
export function resetBuckets() {
  for (const b of Object.values(buckets)) b.reset();
  loginFails.clear();
}

// --- Per-email login throttle (used by the auth controller) ---
export function checkLoginAllowed(email) {
  if (env.isTest) return;
  const key = String(email || '').toLowerCase();
  const entry = loginFails.get(key);
  if (entry && Date.now() < entry.resetAt && entry.count >= env.limits.loginFailsPer15Min) {
    throw appError(ERROR_CODES.RATE_LIMITED, 'Too many attempts. Try again later.');
  }
}

export function recordLoginFailure(email) {
  const key = String(email || '').toLowerCase();
  const now = Date.now();
  const entry = loginFails.get(key);
  if (!entry || now > entry.resetAt) {
    loginFails.set(key, { count: 1, resetAt: now + LOGIN_WINDOW });
  } else {
    entry.count += 1;
  }
}

export function clearLoginFailures(email) {
  loginFails.delete(String(email || '').toLowerCase());
}

// --- REST limiters ---
const jsonTooMany = (message) => (_req, res) =>
  res.status(429).json({ error: { code: ERROR_CODES.RATE_LIMITED, message } });

// Room creation: now limited per USER (requireAuth runs first, so req.userId is set).
export const roomCreateLimiter = rateLimit({
  windowMs: 60 * MINUTE,
  limit: env.limits.roomCreatePerHour,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  skip: () => env.isTest,
  handler: jsonTooMany('Too many rooms created'),
});

// Auth endpoints: per IP, 15-minute window.
export const authLimiter = rateLimit({
  windowMs: LOGIN_WINDOW,
  limit: env.limits.authPer15Min,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: jsonTooMany('Too many requests. Try again later.'),
});
