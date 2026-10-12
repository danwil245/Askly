import { z } from 'zod';
import {
  createQuiz,
  listQuizzes,
  getQuizOwnedOrThrow,
  replaceQuiz,
  deleteQuiz,
  hostQuiz,
  listGames,
} from '../services/quizService.js';
import { Room } from '../models/Room.js';

const optionSchema = z.object({
  id: z.string().trim().min(1).optional(),
  text: z.string().trim().min(1).max(100),
});

const questionSchema = z.object({
  id: z.string().trim().min(1).optional(),
  text: z.string().trim().min(1).max(200),
  options: z.array(optionSchema).min(2).max(4),
  correctOptionId: z.string().trim().min(1),
  timeLimitSec: z.number().int().min(5).max(120).optional(),
});

export const quizInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  description: z.string().trim().max(300).optional(),
  questions: z.array(questionSchema).min(1, 'Add at least one question').max(50),
});

export const idParamSchema = z.object({ id: z.string().trim().min(1) });

function serializeQuiz(quiz) {
  return {
    id: String(quiz._id),
    title: quiz.title,
    description: quiz.description,
    questions: quiz.questions, // includes correctOptionId (owner-only endpoint)
    updatedAt: quiz.updatedAt,
  };
}

export async function getQuizzes(req, res, next) {
  try {
    res.json({ quizzes: await listQuizzes(req.userId) });
  } catch (err) {
    next(err);
  }
}

export async function postQuiz(req, res, next) {
  try {
    const quiz = await createQuiz(req.userId, req.body);
    res.status(201).json({ quiz: serializeQuiz(quiz) });
  } catch (err) {
    next(err);
  }
}

export async function getQuiz(req, res, next) {
  try {
    const quiz = await getQuizOwnedOrThrow(req.params.id, req.userId);
    res.json({ quiz: serializeQuiz(quiz) });
  } catch (err) {
    next(err);
  }
}

export async function putQuiz(req, res, next) {
  try {
    const quiz = await getQuizOwnedOrThrow(req.params.id, req.userId);
    await replaceQuiz(quiz, req.body);
    res.json({ quiz: serializeQuiz(quiz) });
  } catch (err) {
    next(err);
  }
}

export async function deleteQuizHandler(req, res, next) {
  try {
    const quiz = await getQuizOwnedOrThrow(req.params.id, req.userId);
    await deleteQuiz(quiz);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function hostQuizHandler(req, res, next) {
  try {
    const quiz = await getQuizOwnedOrThrow(req.params.id, req.userId);
    let parentOpts = {};
    if (req.body?.parentRoomCode) {
      const parentRoom = await Room.findOne({
        code: String(req.body.parentRoomCode).toUpperCase(),
        ownerId: req.userId,
      });
      if (parentRoom) {
        parentOpts = {
          parentRoomId: parentRoom._id,
          parentSessionId: parentRoom.currentSessionId,
          parentRoomCode: parentRoom.code,
        };
      }
    }
    const { code } = await hostQuiz(quiz, req.userId, parentOpts);
    res.status(201).json({ code });
  } catch (err) {
    next(err);
  }
}

export async function getGames(req, res, next) {
  try {
    res.json({ games: await listGames(req.userId) });
  } catch (err) {
    next(err);
  }
}
