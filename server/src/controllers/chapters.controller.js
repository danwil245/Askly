import { z } from 'zod';
import {
  createChapter,
  listChapters,
  getChapterOwnedOrThrow,
  patchChapter,
} from '../services/chapterService.js';
import { serializeChapter } from '../utils/serialize.js';

export const createChapterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(300).optional(),
});

export const patchChapterSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(300).optional(),
    archived: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Nothing to update' });

export const listQuerySchema = z.object({
  includeArchived: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

export const idParamSchema = z.object({ id: z.string().trim().min(1) });

export async function getChapters(req, res, next) {
  try {
    const chapters = await listChapters(req.userId, {
      includeArchived: req.query.includeArchived,
    });
    res.json({ chapters });
  } catch (err) {
    next(err);
  }
}

export async function postChapter(req, res, next) {
  try {
    const chapter = await createChapter({ ownerId: req.userId, ...req.body });
    res.status(201).json({ chapter: serializeChapter(chapter) });
  } catch (err) {
    next(err);
  }
}

export async function patchChapterHandler(req, res, next) {
  try {
    const chapter = await getChapterOwnedOrThrow(req.params.id, req.userId);
    await patchChapter(chapter, req.body);
    res.json({ chapter: serializeChapter(chapter) });
  } catch (err) {
    next(err);
  }
}
