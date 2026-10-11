import { Router } from 'express';
import {
  getQuizzes,
  postQuiz,
  getQuiz,
  putQuiz,
  deleteQuizHandler,
  hostQuizHandler,
  getGames,
  quizInputSchema,
  idParamSchema,
} from '../controllers/quizzes.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

export const quizzesRouter = Router();

quizzesRouter.get('/', requireAuth, getQuizzes);
quizzesRouter.post('/', requireAuth, validate(quizInputSchema, 'body'), postQuiz);

// Static path before '/:id' so it isn't shadowed.
quizzesRouter.get('/games', requireAuth, getGames);

quizzesRouter.get('/:id', requireAuth, validate(idParamSchema, 'params'), getQuiz);
quizzesRouter.put(
  '/:id',
  requireAuth,
  validate(idParamSchema, 'params'),
  validate(quizInputSchema, 'body'),
  putQuiz
);
quizzesRouter.delete('/:id', requireAuth, validate(idParamSchema, 'params'), deleteQuizHandler);
quizzesRouter.post('/:id/host', requireAuth, validate(idParamSchema, 'params'), hostQuizHandler);
