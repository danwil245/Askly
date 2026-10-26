import { Question } from '../models/Question.js';
import { getRoomByCodeOrThrow, assertRoomOpen } from './roomService.js';
import { getQuestionOrThrow } from './questionService.js';
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

  // A hidden question can't stay on the audience's "Now answering" banner.
  let spotlightCleared = false;
  if (q.hidden && String(room.spotlightQuestionId) === String(q._id)) {
    room.spotlightQuestionId = null;
    await room.save();
    spotlightCleared = true;
  }
  return { question: q, room, spotlightCleared };
}

/**
 * Spotlight one question ("Now answering"), or clear it with questionId = null.
 * Moving on from a previously spotlighted question marks that one answered.
 */
export async function setSpotlight({ roomCode, questionId }) {
  const room = await getRoomByCodeOrThrow(roomCode);
  assertRoomOpen(room);

  let next = null;
  if (questionId) {
    next = await getQuestionOrThrow(room._id, questionId);
    if (next.hidden) {
      throw appError(ERROR_CODES.VALIDATION_ERROR, 'Unhide the question before spotlighting it');
    }
  }

  const prevId = room.spotlightQuestionId;
  let previous = null;
  if (prevId && String(prevId) !== String(next?._id)) {
    previous = await Question.findOneAndUpdate(
      { _id: prevId, roomId: room._id },
      { $set: { answered: true } },
      { new: true }
    );
  }

  room.spotlightQuestionId = next ? next._id : null;
  await room.save();
  return { room, previous, questionId: next ? String(next._id) : null };
}
