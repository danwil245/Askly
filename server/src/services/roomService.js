/**
 * Room service — core persistence and state-reading operations for qa and mentor rooms.
 *
 * Responsibilities:
 *   - Create rooms (qa or mentor), validate chapter ownership for mentor type, and
 *     open the first Session in a single atomic sequence.
 *   - Provide lookup helpers (`getRoomByCodeOrThrow`, `getRoomMeta`) used by
 *     controllers and socket handlers.
 *   - List a mentor's rooms with optional type/chapter/status filtering.
 *   - Build the full `room:state` snapshot sent to clients on socket join, including
 *     all questions and polls across every session (history is preserved on reopen).
 *   - Handle room updates (title, chapter reassignment, settings).
 *
 * This service intentionally does NOT contain open/close/reopen logic; that lives in
 * roomLifecycleService.js so the behavior is shared between REST and socket handlers.
 *
 * Constants:
 *   MAX_STATE_QUESTIONS — caps the questions returned in a state snapshot (500).
 *   MAX_STATE_POLLS     — caps the polls returned in a state snapshot (100).
 */
import { Room } from '../models/Room.js';
import { Question } from '../models/Question.js';
import { Poll } from '../models/Poll.js';
import { Vote } from '../models/Vote.js';
import { Session } from '../models/Session.js';
import { Chapter } from '../models/Chapter.js';
import { generateUniqueCode } from '../utils/joinCode.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';
import { cleanText } from '../utils/sanitize.js';
import {
  serializeRoom,
  serializeRoomMeta,
  serializeSession,
  serializeQuestion,
  serializePoll,
} from '../utils/serialize.js';

const MAX_STATE_QUESTIONS = 500;
const MAX_STATE_POLLS = 100;

/**
 * Generate a default session name such as "Session, Oct 25, 10:30 PM".
 * Used when a room is first created or reopened without an explicit name.
 */
export const defaultSessionName = (date = new Date()) =>
  `Session, ${date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;

/**
 * Create a qa/mentor room, open, with its first Session.
 *
 * For mentor rooms, `chapterId` is required and must refer to a Chapter owned by
 * `ownerId`; otherwise a NOT_FOUND error is thrown (ownership is validated here,
 * not at the controller layer).
 *
 * A 6-character join code is generated and guaranteed unique at creation time.
 * The room is set open and the first Session document is created atomically as
 * part of the same operation; `currentSessionId` is set before the final save.
 *
 * @returns {{ room, currentSession }}
 */
export async function createRoom({ ownerId, type, title, chapterId = null }) {
  if (!['qa', 'mentor'].includes(type)) {
    throw appError(ERROR_CODES.VALIDATION_ERROR, 'Invalid room type');
  }
  if (type === 'mentor') {
    // Chapter must exist and belong to the requesting user.
    requireObjectId(chapterId, 'Chapter');
    const chapter = await Chapter.findOne({ _id: chapterId, ownerId });
    if (!chapter) throw appError(ERROR_CODES.NOT_FOUND, 'Chapter not found');
  }

  const code = await generateUniqueCode(async (c) => !!(await Room.exists({ code: c })));
  const room = await Room.create({
    code,
    ownerId,
    type,
    title: cleanText(title, { singleLine: true }),
    // chapterId is stored only for mentor rooms; qa rooms leave it null.
    chapterId: type === 'mentor' ? chapterId : null,
  });

  // Create the first Session immediately so the room is immediately usable.
  const session = await Session.create({
    roomId: room._id,
    roomCode: room.code,
    ownerId,
    name: defaultSessionName(),
    status: 'active',
  });
  room.currentSessionId = session._id;
  await room.save();

  return { room, currentSession: session };
}

/** Fetch a room by its 6-character code (normalised to uppercase). Throws ROOM_NOT_FOUND if absent. */
export async function getRoomByCodeOrThrow(code) {
  const room = await Room.findOne({ code: String(code).toUpperCase() });
  if (!room) throw appError(ERROR_CODES.ROOM_NOT_FOUND, 'Room not found');
  return room;
}

/** Public meta for the landing join box (routes by type). */
export async function getRoomMeta(code) {
  const room = await getRoomByCodeOrThrow(code);
  return serializeRoomMeta(room);
}

/** Throw ROOM_CLOSED if the room is not open. Used by socket handlers before accepting writes. */
export function assertRoomOpen(room) {
  if (room.status === 'closed') throw appError(ERROR_CODES.ROOM_CLOSED, 'This room is closed');
}

/** Throw FORBIDDEN unless userId owns the room. */
export function assertOwner(room, userId) {
  if (!userId || String(room.ownerId) !== String(userId)) {
    throw appError(ERROR_CODES.FORBIDDEN, 'You do not own this room');
  }
}

/**
 * Apply a partial update to a room document.
 * When reassigning `chapterId` on a mentor room, the new chapter must be owned by the
 * same user — this is the move-between-chapters feature used by RoomCard's selector.
 */
export async function updateRoom(room, { title, chapterId, settings }) {
  if (title !== undefined) room.title = cleanText(title, { singleLine: true });
  if (chapterId !== undefined && room.type === 'mentor') {
    requireObjectId(chapterId, 'Chapter');
    const chapter = await Chapter.findOne({ _id: chapterId, ownerId: room.ownerId });
    if (!chapter) throw appError(ERROR_CODES.NOT_FOUND, 'Chapter not found');
    room.chapterId = chapterId;
  }
  if (settings?.showAuthorNames) room.settings.showAuthorNames = settings.showAuthorNames;
  await room.save();
  return room;
}

/**
 * List the caller's rooms with current session and last-activity info.
 * Supports optional filters: type, chapterId (mentor rooms per chapter), and status.
 * `chapterId` filtering is how ChapterPage loads its room list.
 */
export async function listMyRooms(ownerId, { type, chapterId, status } = {}) {
  const q = { ownerId };
  if (type) q.type = type;
  if (status) q.status = status;
  if (chapterId) q.chapterId = chapterId;

  const rooms = await Room.find(q).sort({ updatedAt: -1 }).lean();
  // Batch-load the current sessions to avoid N+1 queries.
  const sessionIds = rooms.map((r) => r.currentSessionId).filter(Boolean);
  const sessions = await Session.find({ _id: { $in: sessionIds } }).lean();
  const byId = new Map(sessions.map((s) => [String(s._id), s]));

  return rooms.map((r) => {
    const cur = r.currentSessionId ? byId.get(String(r.currentSessionId)) : null;
    return {
      code: r.code,
      title: r.title,
      type: r.type,
      status: r.status,
      chapterId: r.chapterId ? String(r.chapterId) : null,
      settings: r.settings,
      currentSession: cur ? serializeSession(cur) : null,
      lastActivityAt: r.updatedAt,
    };
  });
}

/**
 * Full room:state snapshot (v2). Includes items from ALL sessions (each carries
 * sessionId) so a reopened room shows its history. Audience gets non-hidden questions.
 *
 * For mentor rooms, the associated Chapter document is fetched and embedded so the
 * client can display the chapter name in the presenter dashboard.
 *
 * `myVotes` and `myUpvotes` are per-user personalisation; they are empty arrays when
 * `userId` is not provided (anonymous/quiz users).
 */
export async function getRoomState(code, { userId, isHost }) {
  const room = await getRoomByCodeOrThrow(code);
  const showNames = room.settings?.showAuthorNames === 'all';

  // Embed chapter data for mentor rooms so the client receives it in one round trip.
  const chapter = room.chapterId ? await Chapter.findById(room.chapterId).lean() : null;

  // Hosts see all questions; audience only sees non-hidden ones.
  const questionQuery = isHost
    ? { roomId: room._id }
    : { roomId: room._id, hidden: false };

  const [questions, polls, sessions, myVoteDocs] = await Promise.all([
    Question.find(questionQuery).sort({ createdAt: -1 }).limit(MAX_STATE_QUESTIONS).lean(),
    Poll.find({ roomId: room._id }).sort({ createdAt: 1 }).limit(MAX_STATE_POLLS).lean(),
    Session.find({ roomId: room._id }).sort({ startedAt: -1 }).lean(),
    userId ? Vote.find({ roomId: room._id, userId }).lean() : Promise.resolve([]),
  ]);

  // Build quick-lookup maps for the authenticated user's own votes and upvotes.
  const myVotes = {};
  for (const v of myVoteDocs) myVotes[String(v.pollId)] = v.optionId;

  const myUpvotes = userId
    ? questions.filter((q) => (q.upvotes || []).includes(String(userId))).map((q) => String(q._id))
    : [];

  return {
    room: serializeRoom(room, { chapter }),
    currentSessionId: room.currentSessionId ? String(room.currentSessionId) : null,
    sessions: sessions.map(serializeSession),
    questions: questions.map((q) => serializeQuestion(q, { isHost, showNames })),
    polls: polls.map(serializePoll),
    myVotes,
    myUpvotes,
    isHost: !!isHost,
  };
}
