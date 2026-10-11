import { z } from 'zod';
import {
  createRoom,
  getRoomMeta,
  getRoomByCodeOrThrow,
  updateRoom,
  listMyRooms,
  assertOwner,
} from '../services/roomService.js';
import * as lifecycle from '../services/roomLifecycleService.js';
import { listSessionsForRoom } from '../services/sessionService.js';
import { getSnapshot } from '../services/analyticsService.js';
import { serializeRoom, serializeSession } from '../utils/serialize.js';
import { emitRoomUpdated, getIo } from '../sockets/broadcast.js';

export const codeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'Invalid join code'),
});

export const createRoomSchema = z
  .object({
    type: z.enum(['qa', 'mentor']),
    title: z.string().trim().min(1, 'Title is required').max(80),
    chapterId: z.string().trim().min(1).optional(),
  })
  .refine((o) => o.type !== 'mentor' || !!o.chapterId, {
    message: 'A mentor room needs a chapter',
    path: ['chapterId'],
  });

export const patchRoomSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  chapterId: z.string().trim().min(1).optional(),
  settings: z.object({ showAuthorNames: z.enum(['host', 'all']) }).partial().optional(),
});

export const mineQuerySchema = z.object({
  type: z.enum(['qa', 'mentor', 'quiz']).optional(),
  chapterId: z.string().trim().min(1).optional(),
  status: z.enum(['open', 'closed']).optional(),
});

export const analyticsQuerySchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
});

export const closeRoomSchema = z.object({
  sessionName: z.string().trim().max(100).optional(),
});

/** Broadcast room:updated through the socket layer (no-op if sockets aren't attached). */
async function broadcastRoomUpdated(room) {
  const io = getIo();
  if (!io) return;
  emitRoomUpdated(io, room.code, await lifecycle.roomUpdatedPayload(room));
}

export async function getRoom(req, res, next) {
  try {
    res.json(await getRoomMeta(req.params.code));
  } catch (err) {
    next(err);
  }
}

export async function postRoom(req, res, next) {
  try {
    const { type, title, chapterId } = req.body;
    const { room, currentSession } = await createRoom({
      ownerId: req.userId,
      type,
      title,
      chapterId,
    });
    res.status(201).json({
      room: serializeRoom(room),
      currentSession: serializeSession(currentSession),
    });
  } catch (err) {
    next(err);
  }
}

export async function getMine(req, res, next) {
  try {
    res.json({ rooms: await listMyRooms(req.userId, req.query) });
  } catch (err) {
    next(err);
  }
}

export async function patchRoom(req, res, next) {
  try {
    const room = await getRoomByCodeOrThrow(req.params.code);
    assertOwner(room, req.userId);
    await updateRoom(room, req.body);
    res.json({ room: serializeRoom(room) });
  } catch (err) {
    next(err);
  }
}

export async function openRoom(req, res, next) {
  try {
    const room = await getRoomByCodeOrThrow(req.params.code);
    assertOwner(room, req.userId);
    lifecycle.ensureQaOrMentor(room);
    const { sessions } = await lifecycle.open(room);
    await broadcastRoomUpdated(room);
    res.json({ room: serializeRoom(room), sessions });
  } catch (err) {
    next(err);
  }
}

export async function closeRoom(req, res, next) {
  try {
    const room = await getRoomByCodeOrThrow(req.params.code);
    assertOwner(room, req.userId);
    lifecycle.ensureQaOrMentor(room);
    const { sessions } = await lifecycle.close(room, { sessionName: req.body?.sessionName });
    await broadcastRoomUpdated(room);
    res.json({ room: serializeRoom(room), sessions });
  } catch (err) {
    next(err);
  }
}

export async function getRoomSessions(req, res, next) {
  try {
    const room = await getRoomByCodeOrThrow(req.params.code);
    assertOwner(room, req.userId);
    res.json({ sessions: await listSessionsForRoom(room._id) });
  } catch (err) {
    next(err);
  }
}

export async function getAnalytics(req, res, next) {
  try {
    const room = await getRoomByCodeOrThrow(req.params.code);
    assertOwner(room, req.userId);
    res.json(await getSnapshot(room.code, { sessionId: req.query.sessionId }));
  } catch (err) {
    next(err);
  }
}
