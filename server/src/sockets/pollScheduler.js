import { Poll } from '../models/Poll.js';
import { expirePoll } from '../services/pollService.js';
import { emitPoll, scheduleAnalytics } from './broadcast.js';
import { log } from '../utils/logger.js';

// Timers improve the live experience; the persisted closesAt field and expirePoll's
// atomic query remain the source of truth when a server is restarted or delayed.
const timers = new Map();

const pollKey = (poll) => String(poll.id || poll._id);

export function cancelPollClose(poll) {
  const key = typeof poll === 'string' ? poll : pollKey(poll);
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
}

export function schedulePollClose(io, poll) {
  cancelPollClose(poll);
  if (poll.status !== 'open' || !poll.closesAt) return;

  const key = pollKey(poll);
  // Give the event loop a tiny margin so the server-side expiry predicate is true.
  const delay = Math.max(0, new Date(poll.closesAt).getTime() - Date.now()) + 10;
  const timer = setTimeout(async () => {
    timers.delete(key);
    try {
      const expired = await expirePoll(key);
      if (expired) {
        emitPoll(io, expired.roomCode, 'poll:updated', expired);
        scheduleAnalytics(io, expired.roomCode);
      }
    } catch (err) {
      log.error('poll.expiry.failed', { pollId: key, message: err?.message });
    }
  }, delay);
  if (timer.unref) timer.unref();
  timers.set(key, timer);
}

/** Restore deadline notifications after a server restart. */
export async function scheduleOpenTimedPolls(io) {
  const polls = await Poll.find({ status: 'open', closesAt: { $ne: null } }).lean();
  polls.forEach((poll) => schedulePollClose(io, poll));
}

export function clearPollTimers() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}
