import { Question } from '../models/Question.js';
import { getRoomOrThrow, assertRoomOpen } from './roomService.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';
import { env } from '../config/env.js';

/**
 * Create a question after room + duplicate-window checks. Text is already trimmed,
 * length-bounded and control-stripped by the zod schema.
 */
export async function createQuestion({ roomCode, text, authorId }) {
  const room = await getRoomOrThrow(roomCode);
  assertRoomOpen(room);

  // Reject an exact duplicate from the same room within the configured window.
  const since = new Date(Date.now() - env.limits.duplicateQuestionWindowMs);
  const dup = await Question.findOne({ roomCode, text, createdAt: { $gte: since } }).lean();
  if (dup) throw appError(ERROR_CODES.DUPLICATE_QUESTION, 'You already asked that just now');

  const q = await Question.create({ roomCode, text, authorId });
  return q;
}

/**
 * Atomic upvote toggle for a clientId. No read-modify-write races:
 * the $ne / exact-match filter decides add vs remove in a single op.
 */
export async function toggleUpvote({ roomCode, questionId, clientId }) {
  requireObjectId(questionId, 'Question');
  const room = await getRoomOrThrow(roomCode);
  assertRoomOpen(room);

  // Try to add the upvote (only matches if the client hasn't upvoted yet).
  const added = await Question.findOneAndUpdate(
    { _id: questionId, roomCode, upvotes: { $ne: clientId } },
    { $addToSet: { upvotes: clientId }, $inc: { upvoteCount: 1 } },
    { new: true }
  );
  if (added) return added;

  // Otherwise remove it (only matches if the client had upvoted).
  const removed = await Question.findOneAndUpdate(
    { _id: questionId, roomCode, upvotes: clientId },
    { $pull: { upvotes: clientId }, $inc: { upvoteCount: -1 } },
    { new: true }
  );
  if (removed) return removed;

  // Neither matched: the question doesn't exist in this room.
  throw appError(ERROR_CODES.NOT_FOUND, 'Question not found');
}

export async function getQuestionOrThrow(roomCode, questionId) {
  requireObjectId(questionId, 'Question');
  const q = await Question.findOne({ _id: questionId, roomCode });
  if (!q) throw appError(ERROR_CODES.NOT_FOUND, 'Question not found');
  return q;
}
