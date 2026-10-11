import { Question } from '../models/Question.js';
import { getRoomByCodeOrThrow } from './roomService.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';

/**
 * Host-only moderation. Authorization (ownership) is enforced in the handler/controller
 * layer; these functions assume the caller is already authorized.
 */

export async function setAnswered({ roomCode, questionId, answered }) {
  requireObjectId(questionId, 'Question');
  const room = await getRoomByCodeOrThrow(roomCode);
  const q = await Question.findOneAndUpdate(
    { _id: questionId, roomId: room._id },
    { $set: { answered: !!answered } },
    { new: true }
  );
  if (!q) throw appError(ERROR_CODES.NOT_FOUND, 'Question not found');
  return { question: q, room };
}

export async function setHidden({ roomCode, questionId, hidden }) {
  requireObjectId(questionId, 'Question');
  const room = await getRoomByCodeOrThrow(roomCode);
  const q = await Question.findOneAndUpdate(
    { _id: questionId, roomId: room._id },
    { $set: { hidden: !!hidden } },
    { new: true }
  );
  if (!q) throw appError(ERROR_CODES.NOT_FOUND, 'Question not found');
  return { question: q, room };
}
