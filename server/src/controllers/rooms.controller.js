/**
 * Rooms controller — HTTP request handlers for the /api/rooms resource.
 *
 * Responsibilities:
 *   - Define Zod schemas for request validation across all room endpoints.
 *   - Delegate business logic to roomService (creation, listing, updates) and
 *     roomLifecycleService (open/close); controllers do not query the DB directly.
 *   - Enforce ownership via `assertOwner` before any mutating operation.
 *   - Emit `room:updated` socket broadcasts after lifecycle changes so connected
 *     clients receive the new room status in real time.
 *   - Propagate errors to Express's centralized error handler via `next(err)`.
 *
 * Mentor-room-specific logic:
 *   `createRoomSchema` uses `.refine()` to enforce that a `chapterId` is always
 *   provided when `type === 'mentor'`. Chapter ownership is verified inside
 *   `createRoom()` in the service layer.
 *
 *   `patchRoomSchema` allows `chapterId` to be updated, which moves a mentor room
 *   between chapters (move-between-chapters feature). The service validates that
 *   the target chapter is owned by the same user.
 */
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

// 6-character alphanumeric join code, uppercase-normalised.
export const codeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'Invalid join code'),
});

// `.refine()` enforces that mentor rooms always supply a chapterId at the HTTP layer,
// before the service performs the ownership check.
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
  // Updating chapterId moves a mentor room to a different chapter.
  chapterId: z.string().trim().min(1).optional(),
  settings: z.object({ showAuthorNames: z.enum(['host', 'all']) }).partial().optional(),
});

// Supports GET /api/rooms/mine?type=mentor&chapterId=... used by ChapterPage.
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

/**
 * Emit a `room:updated` event to all sockets in the room after a lifecycle change.
 * No-op when Socket.io is not yet attached (e.g. during REST-only tests).
 */
async function broadcastRoomUpdated(room) {
  const io = getIo();
  if (!io) return;
  emitRoomUpdated(io, room.code, await lifecycle.roomUpdatedPayload(room));
}

/** GET /api/rooms/:code — public room metadata (type, status) for the landing join box. */
export async function getRoom(req, res, next) {
  try {
    res.json(await getRoomMeta(req.params.code));
  } catch (err) {
    next(err);
  }
}

/** POST /api/rooms — create a qa or mentor room for the authenticated user. */
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

/** GET /api/rooms/mine — list the caller's rooms, with optional type/chapter/status filters. */
export async function getMine(req, res, next) {
  try {
    res.json({ rooms: await listMyRooms(req.userId, req.query) });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/rooms/:code — update title, chapter assignment, or author-name settings. */
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

/** POST /api/rooms/:code/open — reopen a closed qa or mentor room (creates a new session). */
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

/** POST /api/rooms/:code/close — close an open room, optionally naming the session. */
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

/** GET /api/rooms/:code/sessions — list all sessions for the room (owner only). */
export async function getRoomSessions(req, res, next) {
  try {
    const room = await getRoomByCodeOrThrow(req.params.code);
    assertOwner(room, req.userId);
    res.json({ sessions: await listSessionsForRoom(room._id) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/rooms/:code/analytics — get analytics snapshot for the room (owner only). */
export async function getAnalytics(req, res, next) {
  try {
    const room = await getRoomByCodeOrThrow(req.params.code);
    assertOwner(room, req.userId);
    res.json(await getSnapshot(room.code, { sessionId: req.query.sessionId }));
  } catch (err) {
    next(err);
  }
}
