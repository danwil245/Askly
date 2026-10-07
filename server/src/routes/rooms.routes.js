import { Router } from 'express';
import {
  postRoom,
  getRoom,
  getAnalytics,
  createRoomSchema,
  codeParamSchema,
} from '../controllers/rooms.controller.js';
import { validate } from '../middleware/validate.js';
import { hostAuth } from '../middleware/hostAuth.js';
import { roomCreateLimiter } from '../middleware/antiSpam.js';

export const roomsRouter = Router();

// Create a room (rate limited per IP).
roomsRouter.post('/', roomCreateLimiter, validate(createRoomSchema, 'body'), postRoom);

// Public room meta so the join page can validate a code.
roomsRouter.get('/:code', validate(codeParamSchema, 'params'), getRoom);

// Host-only full analytics snapshot.
roomsRouter.get('/:code/analytics', validate(codeParamSchema, 'params'), hostAuth, getAnalytics);
