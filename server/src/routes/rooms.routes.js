import { Router } from 'express';
import {
  getRoom,
  postRoom,
  getMine,
  patchRoom,
  openRoom,
  closeRoom,
  getRoomSessions,
  getAnalytics,
  codeParamSchema,
  createRoomSchema,
  patchRoomSchema,
  mineQuerySchema,
  analyticsQuerySchema,
  closeRoomSchema,
} from '../controllers/rooms.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { roomCreateLimiter } from '../middleware/antiSpam.js';

export const roomsRouter = Router();

// Create a room (auth + per-user rate limit).
roomsRouter.post('/', requireAuth, roomCreateLimiter, validate(createRoomSchema, 'body'), postRoom);

// The caller's rooms — registered before '/:code' so it isn't shadowed.
roomsRouter.get('/mine', requireAuth, validate(mineQuerySchema, 'query'), getMine);

// Public room meta so the landing join box can route by type.
roomsRouter.get('/:code', validate(codeParamSchema, 'params'), getRoom);

roomsRouter.patch(
  '/:code',
  requireAuth,
  validate(codeParamSchema, 'params'),
  validate(patchRoomSchema, 'body'),
  patchRoom
);

roomsRouter.post('/:code/open', requireAuth, validate(codeParamSchema, 'params'), openRoom);

roomsRouter.post(
  '/:code/close',
  requireAuth,
  validate(codeParamSchema, 'params'),
  validate(closeRoomSchema, 'body'),
  closeRoom
);

roomsRouter.get(
  '/:code/sessions',
  requireAuth,
  validate(codeParamSchema, 'params'),
  getRoomSessions
);

roomsRouter.get(
  '/:code/analytics',
  requireAuth,
  validate(codeParamSchema, 'params'),
  validate(analyticsQuerySchema, 'query'),
  getAnalytics
);
