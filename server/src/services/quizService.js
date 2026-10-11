import crypto from 'node:crypto';
import { Quiz } from '../models/Quiz.js';
import { Room } from '../models/Room.js';
import { Session } from '../models/Session.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';
import { cleanText } from '../utils/sanitize.js';
import { generateUniqueCode } from '../utils/joinCode.js';

/** Normalize + validate a quiz payload, (re)generating stable ids for questions/options. */
function normalizeQuiz(input) {
  const questions = (input.questions || []).map((q) => {
    const options = (q.options || []).map((o) => ({
      id: o.id || crypto.randomUUID(),
      text: cleanText(o.text, { singleLine: true }),
    }));
    const correct = options.find((o) => o.id === q.correctOptionId);
    if (!correct) throw appError(ERROR_CODES.VALIDATION_ERROR, 'Each question needs a correct option');
    return {
      id: q.id || crypto.randomUUID(),
      text: cleanText(q.text, { singleLine: true }),
      options,
      correctOptionId: correct.id,
      timeLimitSec: q.timeLimitSec || 20,
    };
  });
  return {
    title: cleanText(input.title, { singleLine: true }),
    description: cleanText(input.description || ''),
    questions,
  };
}

export async function createQuiz(ownerId, input) {
  const data = normalizeQuiz(input);
  return Quiz.create({ ownerId, ...data });
}

export async function listQuizzes(ownerId) {
  const quizzes = await Quiz.find({ ownerId }).sort({ updatedAt: -1 }).lean();
  return quizzes.map((q) => ({
    id: String(q._id),
    title: q.title,
    description: q.description,
    questionCount: q.questions.length,
    updatedAt: q.updatedAt,
  }));
}

export async function getQuizOwnedOrThrow(id, ownerId) {
  requireObjectId(id, 'Quiz');
  const quiz = await Quiz.findById(id);
  if (!quiz) throw appError(ERROR_CODES.QUIZ_NOT_FOUND, 'Quiz not found');
  if (String(quiz.ownerId) !== String(ownerId)) {
    throw appError(ERROR_CODES.FORBIDDEN, 'You do not own this quiz');
  }
  return quiz;
}

export async function replaceQuiz(quiz, input) {
  const data = normalizeQuiz(input);
  quiz.title = data.title;
  quiz.description = data.description;
  quiz.questions = data.questions;
  await quiz.save();
  return quiz;
}

export async function deleteQuiz(quiz) {
  await quiz.deleteOne();
}

/**
 * Host a quiz: create a fresh quiz Room (new code every game) + a Session that stores a
 * full snapshot of the quiz (so later edits never alter history). Returns { code }.
 */
export async function hostQuiz(quiz, ownerId) {
  const code = await generateUniqueCode(async (c) => !!(await Room.exists({ code: c })));
  const room = await Room.create({
    code,
    ownerId,
    type: 'quiz',
    title: quiz.title,
    quizId: quiz._id,
    status: 'open',
  });
  const session = await Session.create({
    roomId: room._id,
    roomCode: code,
    ownerId,
    name: `Game, ${new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`,
    status: 'active',
    quizSnapshot: quiz.toObject(),
  });
  room.currentSessionId = session._id;
  await room.save();
  return { code, roomId: room._id, sessionId: session._id };
}

/** Public quiz for the player client (never includes correct answers). */
export function publicQuizQuestion(question, index, total) {
  return {
    index,
    total,
    questionId: question.id,
    text: question.text,
    options: question.options.map((o) => ({ id: o.id, text: o.text })),
    timeLimitSec: question.timeLimitSec,
  };
}

/** Past games (ended Sessions of the caller's quiz rooms). */
export async function listGames(ownerId) {
  const sessions = await Session.find({ ownerId, status: 'ended' })
    .sort({ endedAt: -1 })
    .lean();
  const roomIds = [...new Set(sessions.map((s) => String(s.roomId)))];
  const rooms = await Room.find({ _id: { $in: roomIds }, type: 'quiz' }).lean();
  const quizRoomIds = new Set(rooms.map((r) => String(r._id)));
  return sessions
    .filter((s) => quizRoomIds.has(String(s.roomId)))
    .map((s) => ({
      sessionId: String(s._id),
      name: s.name,
      title: s.quizSnapshot?.title || 'Quiz',
      endedAt: s.endedAt,
      summary: s.summary || null,
      interrupted: !!s.interrupted,
    }));
}
