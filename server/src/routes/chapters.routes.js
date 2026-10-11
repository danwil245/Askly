import { Router } from 'express';
import {
  getChapters,
  postChapter,
  patchChapterHandler,
  createChapterSchema,
  patchChapterSchema,
  listQuerySchema,
  idParamSchema,
} from '../controllers/chapters.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

export const chaptersRouter = Router();

chaptersRouter.get('/', requireAuth, validate(listQuerySchema, 'query'), getChapters);
chaptersRouter.post('/', requireAuth, validate(createChapterSchema, 'body'), postChapter);
chaptersRouter.patch(
  '/:id',
  requireAuth,
  validate(idParamSchema, 'params'),
  validate(patchChapterSchema, 'body'),
  patchChapterHandler
);
