import { Room } from '../models/Room.js';
import { Question } from '../models/Question.js';
import { Poll } from '../models/Poll.js';
import { Vote } from '../models/Vote.js';
import { generateUniqueCode } from '../utils/joinCode.js';
import { generateHostToken, sha256, verifyToken } from '../utils/hash.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { serializeRoom, serializeQuestion, serializePoll } from '../utils/serialize.js';

/**
 * Create a room. Returns the raw host token exactly once — it is never persisted
 * or returned again (only its hash is stored).
 */
export async function createRoom({ title }) {
  const code = await generateUniqueCode(async (c) => !!(await Room.exists({ code: c })));
  const hostToken = generateHostToken();
  const room = await Room.create({ code, title, hostTokenHash: sha256(hostToken) });
  return { code: room.code, title: room.title, hostToken };
}

export async function getRoomOrThrow(code) {
  const room = await Room.findOne({ code });
  if (!room) throw appError(ERROR_CODES.ROOM_NOT_FOUND, 'Room not found');
  return room;
}

/** Public room meta for the join page. */
export async function getRoomMeta(code) {
  const room = await getRoomOrThrow(code);
  return serializeRoom(room);
}

/** True if the supplied raw token matches the room's stored hash. */
export function isValidHostToken(room, hostToken) {
  return !!hostToken && verifyToken(hostToken, room.hostTokenHash);
}

export async function closeRoom(code) {
  const room = await getRoomOrThrow(code);
  if (room.status !== 'closed') {
    room.status = 'closed';
    await room.save();
  }
  return serializeRoom(room);
}

/** Throw if the room is closed — used to guard all audience/host writes. */
export function assertRoomOpen(room) {
  if (room.status === 'closed') {
    throw appError(ERROR_CODES.ROOM_CLOSED, 'This room is closed');
  }
}

/**
 * Build the full `room:state` snapshot for a connecting client. Audience gets only
 * non-hidden questions; host gets everything plus author/upvote detail.
 */
export async function getRoomState(code, { clientId, isHost }) {
  const room = await getRoomOrThrow(code);

  const questionQuery = isHost ? { roomCode: code } : { roomCode: code, hidden: false };
  const [questions, polls, myVoteDocs] = await Promise.all([
    Question.find(questionQuery).sort({ createdAt: -1 }).lean(),
    Poll.find({ roomCode: code }).sort({ createdAt: 1 }).lean(),
    Vote.find({ roomCode: code, clientId }).lean(),
  ]);

  const myVotes = {};
  for (const v of myVoteDocs) myVotes[String(v.pollId)] = v.optionId;

  const myUpvotes = questions
    .filter((q) => (q.upvotes || []).includes(clientId))
    .map((q) => String(q._id));

  return {
    room: serializeRoom(room),
    questions: questions.map((q) => serializeQuestion(q, isHost)),
    polls: polls.map(serializePoll),
    myVotes,
    myUpvotes,
    isHost: !!isHost,
  };
}
