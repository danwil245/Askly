import { Question } from '../models/Question.js';
import { getRoomByCodeOrThrow, assertRoomOpen } from './roomService.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';
import { env } from '../config/env.js';


export async function createQuestion({ roomCode, text, authorUserId, authorName }) {
  const room = await getRoomByCodeOrThrow(roomCode);
  assertRoomOpen(room);

  // Reject an exact duplicate in the same room within the configured window.
  const since = new Date(Date.now() - env.limits.duplicateQuestionWindowMs);
  const dup = await Question.findOne({
    roomId: room._id,
    text,
    createdAt: { $gte: since },
  }).lean();
  if (dup) throw appError(ERROR_CODES.DUPLICATE_QUESTION, 'You already asked that just now');

  const q = await Question.create({
    roomId: room._id,
    roomCode: room.code,
    sessionId: room.currentSessionId,
    authorUserId,
    authorName,
    text,
  });
  return { question: q, room };
}

/** Atomic upvote toggle for a userId. No read-modify-write races. */
export async function toggleUpvote({ roomCode, questionId, userId }) {
  requireObjectId(questionId, 'Question');
  const room = await getRoomByCodeOrThrow(roomCode);
  assertRoomOpen(room);
  const uid = String(userId);

  const added = await Question.findOneAndUpdate(
    { _id: questionId, roomId: room._id, upvotes: { $ne: uid } },
    { $addToSet: { upvotes: uid }, $inc: { upvoteCount: 1 } },
    { new: true }
  );
  if (added) return { question: added, room };

  const removed = await Question.findOneAndUpdate(
    { _id: questionId, roomId: room._id, upvotes: uid },
    { $pull: { upvotes: uid }, $inc: { upvoteCount: -1 } },
    { new: true }
  );
  if (removed) return { question: removed, room };

  throw appError(ERROR_CODES.NOT_FOUND, 'Question not found');
}

export async function getQuestionOrThrow(roomId, questionId) {
  requireObjectId(questionId, 'Question');
  const q = await Question.findOne({ _id: questionId, roomId });
  if (!q) throw appError(ERROR_CODES.NOT_FOUND, 'Question not found');
  return q;
}
