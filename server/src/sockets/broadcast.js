import { serializeQuestion, serializePoll } from '../utils/serialize.js';
import { getSnapshot } from '../services/analyticsService.js';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * All server→client emits funnel through these helpers so the transport stays behind
 * a small surface. Swapping in a Redis adapter later needs no handler changes.
 *
 * Socket rooms:
 *   - `code`            : everyone in the room (audience + host)
 *   - `${code}:host`    : host sockets only (for host-only payloads)
 */

const hostRoom = (code) => `${code}:host`;

// Shared io instance so REST controllers can broadcast through the same layer as the
// socket handlers (keeps lifecycle broadcasts consistent). Set in attachSockets().
let ioRef = null;
export function setIo(io) {
  ioRef = io;
}
export function getIo() {
  return ioRef;
}

export function roomOf(code) {
  return code;
}

/**
 * Broadcast a question to the room, respecting the host/audience field split.
 * Hosts get the full object (authorUserId + upvotes + real name); audience gets the
 * redacted form, with the name shown only when `showNames` (showAuthorNames === 'all').
 */
export function emitQuestion(io, code, event, questionDoc, showNames = false) {
  io.to(hostRoom(code)).emit(event, serializeQuestion(questionDoc, { isHost: true, showNames }));
  io
    .to(code)
    .except(hostRoom(code))
    .emit(event, serializeQuestion(questionDoc, { isHost: false, showNames }));
}

export function emitPoll(io, code, event, pollDoc) {
  io.to(code).emit(event, serializePoll(pollDoc));
}

/** `room:updated` payload is { status, currentSessionId, sessions } (v2 section 8). */
export function emitRoomUpdated(io, code, payload) {
  io.to(code).emit('room:updated', payload);
}

/** Session rename → host room only. */
export function emitSessionRenamed(io, code, session) {
  io.to(hostRoom(code)).emit('session:renamed', { id: String(session._id), name: session.name });
}

export function emitPresence(io, code, count) {
  io.to(code).emit('presence:updated', { count });
}

// --- Analytics push (host-only, throttled per spec section 11) ---
const lastAnalyticsAt = new Map(); // code -> ts
const pendingAnalytics = new Map(); // code -> timeout

export function scheduleAnalytics(io, code) {
  const throttle = env.limits.analyticsThrottleMs;
  const now = Date.now();
  const last = lastAnalyticsAt.get(code) || 0;
  const elapsed = now - last;

  if (elapsed >= throttle) {
    void pushAnalytics(io, code);
    return;
  }
  // Coalesce: ensure one trailing push after the window closes.
  if (!pendingAnalytics.has(code)) {
    const t = setTimeout(() => {
      pendingAnalytics.delete(code);
      void pushAnalytics(io, code);
    }, throttle - elapsed);
    if (t.unref) t.unref();
    pendingAnalytics.set(code, t);
  }
}

async function pushAnalytics(io, code) {
  lastAnalyticsAt.set(code, Date.now());
  try {
    const snapshot = await getSnapshot(code);
    io.to(hostRoom(code)).emit('analytics:updated', snapshot);
  } catch (err) {
    log.error('analytics.push.failed', { code, message: err?.message });
  }
}

export function clearAnalyticsTimers() {
  for (const t of pendingAnalytics.values()) clearTimeout(t);
  pendingAnalytics.clear();
  lastAnalyticsAt.clear();
}
