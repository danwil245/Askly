import { z } from 'zod';
import {
  getSessionOrThrow,
  getSessionReport,
  renameSession,
} from '../services/sessionService.js';
import { serializeSession } from '../utils/serialize.js';
import { assertOwned } from '../middleware/requireOwner.js';

export const idParamSchema = z.object({ id: z.string().trim().min(1) });
export const renameSchema = z.object({ name: z.string().trim().min(1).max(100) });

export async function getSession(req, res, next) {
  try {
    const session = await getSessionOrThrow(req.params.id);
    assertOwned(session, req.userId);
    res.json(await getSessionReport(session));
  } catch (err) {
    next(err);
  }
}

export async function patchSession(req, res, next) {
  try {
    const session = await getSessionOrThrow(req.params.id);
    assertOwned(session, req.userId);
    await renameSession(session, req.body.name);
    res.json({ session: serializeSession(session) });
  } catch (err) {
    next(err);
  }
}
