import { z } from 'zod';
import { createRoom, getRoomMeta } from '../services/roomService.js';
import { getSnapshot } from '../services/analyticsService.js';

export const createRoomSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(80),
});

export const codeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'Invalid join code'),
});

export async function postRoom(req, res, next) {
  try {
    const { title } = req.body;
    const result = await createRoom({ title });
    // Returns the raw hostToken exactly once (spec section 6).
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getRoom(req, res, next) {
  try {
    const meta = await getRoomMeta(req.params.code);
    res.json(meta);
  } catch (err) {
    next(err);
  }
}

export async function getAnalytics(req, res, next) {
  try {
    const snapshot = await getSnapshot(req.params.code);
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
}
