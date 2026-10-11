import { Poll } from '../models/Poll.js';
import { Question } from '../models/Question.js';
import { Vote } from '../models/Vote.js';
import { Session } from '../models/Session.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { cleanText } from '../utils/sanitize.js';
import { serializeSession } from '../utils/serialize.js';
import { defaultSessionName } from './roomService.js';

/**
 * The single source of truth for opening/closing qa & mentor rooms, used by BOTH the
 * REST routes and the socket handlers so behavior cannot diverge (spec section 7/15).
 * Functions mutate + persist and return plain data; the caller is responsible for the
 * `room:updated` broadcast.
 */

async function sessionListPayload(roomId) {
  const sessions = await Session.find({ roomId }).sort({ startedAt: -1 }).lean();
  return sessions.map(serializeSession);
}

/** Build the end-of-session summary for a qa/mentor session. */
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
    session.summary = await buildQaSummary(room._id, session._id);
    await session.save();
  }

  room.status = 'closed';
  room.currentSessionId = null;
  await room.save();

  return { room, sessions: await sessionListPayload(room._id) };
}

/**
 * Reopen a room: start a new session (default name) and set the room open. All prior
 * questions/polls/votes remain in the room (spec section 4).
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

/** Helper for handlers/controllers to shape the room:updated payload. */
export async function roomUpdatedPayload(room) {
  return {
    status: room.status,
    currentSessionId: room.currentSessionId ? String(room.currentSessionId) : null,
    sessions: await sessionListPayload(room._id),
  };
}

export function ensureQaOrMentor(room) {
  if (!['qa', 'mentor'].includes(room.type)) {
    throw appError(ERROR_CODES.VALIDATION_ERROR, 'Not a Q&A or mentor room');
  }
}
