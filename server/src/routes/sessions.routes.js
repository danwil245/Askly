import { Router } from 'express';
import {
  getSession,
  patchSession,
  idParamSchema,
  renameSchema,
} from '../controllers/sessions.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

export const sessionsRouter = Router();

sessionsRouter.get('/:id', requireAuth, validate(idParamSchema, 'params'), getSession);
sessionsRouter.patch(
  '/:id',
  requireAuth,
  validate(idParamSchema, 'params'),
  validate(renameSchema, 'body'),
  patchSession
);
