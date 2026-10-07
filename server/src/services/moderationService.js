import { Question } from '../models/Question.js';
import { getRoomOrThrow } from './roomService.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';

/**
 * Area C — host-only moderation. Authorization (socket.data.isHost) is enforced in
 * the handler layer; these functions assume the caller is already authorized.
 */

export async function setAnswered({ roomCode, questionId, answered }) {
  requireObjectId(questionId, 'Question');
  await getRoomOrThrow(roomCode); // 404 if the room is gone
  const q = await Question.findOneAndUpdate(
    { _id: questionId, roomCode },
    { $set: { answered: !!answered } },
    { new: true }
  );
  if (!q) throw appError(ERROR_CODES.NOT_FOUND, 'Question not found');
  return q;
}

export async function setHidden({ roomCode, questionId, hidden }) {
  requireObjectId(questionId, 'Question');
  await getRoomOrThrow(roomCode);
  const q = await Question.findOneAndUpdate(
    { _id: questionId, roomCode },
    { $set: { hidden: !!hidden } },
    { new: true }
  );
  if (!q) throw appError(ERROR_CODES.NOT_FOUND, 'Question not found');
  return q;
}
