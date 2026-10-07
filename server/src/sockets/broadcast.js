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

export function roomOf(code) {
  return code;
}

/**
 * Broadcast a question to the room, respecting the host/audience field split.
 * Hosts get the full object (authorId + upvotes); audience gets the redacted form.
 */
export function emitQuestion(io, code, event, questionDoc) {
  io.to(hostRoom(code)).emit(event, serializeQuestion(questionDoc, true));
  // Audience = everyone in the room who is NOT in the host sub-room.
  io.to(code).except(hostRoom(code)).emit(event, serializeQuestion(questionDoc, false));
}

export function emitPoll(io, code, event, pollDoc) {
  io.to(code).emit(event, serializePoll(pollDoc));
}

export function emitRoomUpdated(io, code, status) {
  io.to(code).emit('room:updated', { status });
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
