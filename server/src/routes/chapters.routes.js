/**
 * Chapter routes — registers the /api/chapters REST endpoints.
 *
 * Mounted in app.js at `/api/chapters`. All routes require authentication via
 * `requireAuth`, which populates `req.userId` for the controller layer.
 *
 * Middleware chain applied before each handler:
 *   requireAuth   — verify JWT; reject unauthenticated requests with 401.
 *   validate(…)   — parse and coerce the request against a Zod schema; invalid
 *                   input is rejected with 400 VALIDATION_ERROR before the
 *                   handler executes.
 *
 * Routes:
 *   GET  /            → list caller's chapters (with room counts and optional archived).
 *   POST /            → create a new chapter.
 *   PATCH /:id        → update name, description, or archived flag.
 */
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
