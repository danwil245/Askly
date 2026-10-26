/**
 * Room lifecycle service — the single authoritative implementation of open/close/reopen
 * for qa and mentor rooms.
 *
 * Both the REST controller (rooms.controller.js) and socket handlers import from here so
 * the lifecycle logic cannot diverge between the two entry points (spec section 7/15).
 * Functions mutate the room document, persist it, and return plain data. Callers are
 * responsible for emitting the `room:updated` socket event after a successful lifecycle
 * change.
 *
 * Key design decisions for mentor rooms:
 *   - Questions and Polls are stored against the Room (_id), not the Session, so they
 *     accumulate across every open/close cycle. History is never deleted.
 *   - Each close creates a Session summary (questions, answered, polls, votes,
 *     participants) to support the per-session analytics view.
 *   - `open()` always creates a fresh Session; it does not reuse a prior one.
 *   - Both `open()` and `close()` are idempotent: calling them on an already-open or
 *     already-closed room returns the current state without side effects.
 */
import { Poll } from '../models/Poll.js';
import { Question } from '../models/Question.js';
import { Vote } from '../models/Vote.js';
import { Session } from '../models/Session.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { cleanText } from '../utils/sanitize.js';
import { serializeSession } from '../utils/serialize.js';
import { defaultSessionName } from './roomService.js';

/** Return a serialized, reverse-chronological list of all sessions for `roomId`. */
async function sessionListPayload(roomId) {
  const sessions = await Session.find({ roomId }).sort({ startedAt: -1 }).lean();
  return sessions.map(serializeSession);
}

/**
 * Build the end-of-session summary for a qa/mentor session.
 * Aggregates question counts, answer counts, poll and vote totals, and the number of
 * distinct participants across questions, upvotes, and votes in a single session.
 */
async function buildQaSummary(roomId, sessionId) {
  const [qAgg, pollCount, voteAgg, participants] = await Promise.all([
    Question.aggregate([
      { $match: { sessionId } },
      {
        $group: {
          _id: null,
          questions: { $sum: 1 },
          answered: { $sum: { $cond: ['$answered', 1, 0] } },
        },
      },
    ]),
    Poll.countDocuments({ sessionId }),
    Vote.countDocuments({ sessionId }),
    // distinct participants across this session's questions/upvotes/votes
    (async () => {
      const [qp, vp] = await Promise.all([
        Question.aggregate([
          { $match: { sessionId } },
          {
            $project: {
              ids: { $concatArrays: [[{ $toString: '$authorUserId' }], { $ifNull: ['$upvotes', []] }] },
            },
          },
          { $unwind: '$ids' },
          { $group: { _id: '$ids' } },
        ]),
        Vote.aggregate([{ $match: { sessionId } }, { $group: { _id: '$userId' } }]),
      ]);
      const set = new Set([...qp.map((x) => String(x._id)), ...vp.map((x) => String(x._id))]);
      return set.size;
    })(),
  ]);
  const stats = qAgg[0] || { questions: 0, answered: 0 };
  return {
    questions: stats.questions,
    answered: stats.answered,
    polls: pollCount,
    votes: voteAgg,
    participants,
  };
}

/**
 * Close a room: end its active session (optionally naming it), auto-close open polls,
 * write the session summary, and set the room closed.
 *
 * Idempotent: if the room is already closed, returns current state immediately.
 * Auto-closing open polls on room close prevents stale poll state from persisting.
 */
export async function close(room, { sessionName } = {}) {
  if (room.status === 'closed') {
    // Idempotent-ish: just return current state.
    return { room, sessions: await sessionListPayload(room._id) };
  }

  const session = room.currentSessionId
    ? await Session.findById(room.currentSessionId)
    : await Session.findOne({ roomId: room._id, status: 'active' });

  // Auto-close any open polls in the room.
  await Poll.updateMany({ roomId: room._id, status: 'open' }, { $set: { status: 'closed' } });

  if (session) {
    const name = cleanText(sessionName || '', { singleLine: true });
    if (name) session.name = name.slice(0, 100);
    session.status = 'ended';
    session.endedAt = new Date();
    // Store summary metrics on the session for the analytics and history views.
    session.summary = await buildQaSummary(room._id, session._id);
    await session.save();
  }

  room.status = 'closed';
  room.currentSessionId = null;
  room.spotlightQuestionId = null;
  await room.save();

  return { room, sessions: await sessionListPayload(room._id) };
}

/**
 * Reopen a room: start a new session (default name) and set the room open. All prior
 * questions/polls/votes remain in the room (spec section 4).
 *
 * Idempotent: if the room is already open with an active session, returns current state.
 * A new Session is always created — prior sessions are not reactivated.
 */
export async function open(room) {
  if (room.status === 'open' && room.currentSessionId) {
    return { room, sessions: await sessionListPayload(room._id) };
  }

  const session = await Session.create({
    roomId: room._id,
    roomCode: room.code,
    ownerId: room.ownerId,
    name: defaultSessionName(),
    status: 'active',
  });
  room.status = 'open';
  room.currentSessionId = session._id;
  await room.save();

  return { room, sessions: await sessionListPayload(room._id), currentSession: session };
}

/**
 * Build the payload for the `room:updated` socket broadcast.
 * Controllers and socket handlers call this after a lifecycle change to produce a
 * consistent update shape: status, currentSessionId, and the full session list.
 */
export async function roomUpdatedPayload(room) {
  return {
    status: room.status,
    currentSessionId: room.currentSessionId ? String(room.currentSessionId) : null,
    sessions: await sessionListPayload(room._id),
  };
}

/**
 * Guard: throw VALIDATION_ERROR if the room is not a qa or mentor type.
 * Quiz rooms have their own lifecycle managed by quizHandlers; this prevents
 * accidental open/close via the qa/mentor lifecycle endpoints.
 */
export function ensureQaOrMentor(room) {
  if (!['qa', 'mentor'].includes(room.type)) {
    throw appError(ERROR_CODES.VALIDATION_ERROR, 'Not a Q&A or mentor room');
  }
}
