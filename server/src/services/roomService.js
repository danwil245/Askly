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

export const defaultSessionName = (date = new Date()) =>
  `Session, ${date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;

/**
 * Create a qa/mentor room, open, with its first Session.
 * @returns {{ room, currentSession }}
 */
export async function createRoom({ ownerId, type, title, chapterId = null }) {
  if (!['qa', 'mentor'].includes(type)) {
    throw appError(ERROR_CODES.VALIDATION_ERROR, 'Invalid room type');
  }
  if (type === 'mentor') {
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
    chapterId: type === 'mentor' ? chapterId : null,
  });

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

export function assertRoomOpen(room) {
  if (room.status === 'closed') throw appError(ERROR_CODES.ROOM_CLOSED, 'This room is closed');
}

/** Throw FORBIDDEN unless userId owns the room. */
export function assertOwner(room, userId) {
  if (!userId || String(room.ownerId) !== String(userId)) {
    throw appError(ERROR_CODES.FORBIDDEN, 'You do not own this room');
  }
}

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

/** List the caller's rooms with current session + last-activity info. */
export async function listMyRooms(ownerId, { type, chapterId, status } = {}) {
  const q = { ownerId };
  if (type) q.type = type;
  if (status) q.status = status;
  if (chapterId) q.chapterId = chapterId;

  const rooms = await Room.find(q).sort({ updatedAt: -1 }).lean();
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
 */
export async function getRoomState(code, { userId, isHost }) {
  const room = await getRoomByCodeOrThrow(code);
  const showNames = room.settings?.showAuthorNames === 'all';

  const chapter = room.chapterId ? await Chapter.findById(room.chapterId).lean() : null;

  const questionQuery = isHost
    ? { roomId: room._id }
    : { roomId: room._id, hidden: false };

  const [questions, polls, sessions, myVoteDocs] = await Promise.all([
    Question.find(questionQuery).sort({ createdAt: -1 }).limit(MAX_STATE_QUESTIONS).lean(),
    Poll.find({ roomId: room._id }).sort({ createdAt: 1 }).limit(MAX_STATE_POLLS).lean(),
    Session.find({ roomId: room._id }).sort({ startedAt: -1 }).lean(),
    userId ? Vote.find({ roomId: room._id, userId }).lean() : Promise.resolve([]),
  ]);

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
