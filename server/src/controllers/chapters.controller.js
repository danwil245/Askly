/**
 * Chapters controller — HTTP request handlers for the /api/chapters resource.
 *
 * Responsibilities:
 *   - Define Zod schemas for request validation (body, query, params). Schemas are
 *     exported so the route file can apply them as middleware via `validate()`.
 *   - Delegate business logic entirely to chapterService; controllers do not query the
 *     database directly.
 *   - Propagate service errors to Express's centralized error handler via `next(err)`.
 *
 * All routes require authentication. `req.userId` is set by `requireAuth` middleware
 * before these handlers execute.
 *
 * Endpoints handled here (registered in chapters.routes.js):
 *   GET  /api/chapters           → getChapters        (list with room counts)
 *   POST /api/chapters           → postChapter        (create a chapter)
 *   PATCH /api/chapters/:id      → patchChapterHandler (rename, re-describe, archive)
 */
import { z } from 'zod';
import {
  createChapter,
  listChapters,
  getChapterOwnedOrThrow,
  patchChapter,
} from '../services/chapterService.js';
import { serializeChapter } from '../utils/serialize.js';

// Validated by the `validate(createChapterSchema, 'body')` middleware on POST /api/chapters.
export const createChapterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(300).optional(),
});

// At least one field must be present; enforced by the `.refine()` call below.
export const patchChapterSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(300).optional(),
    archived: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Nothing to update' });

// `includeArchived` can arrive as a boolean (programmatic) or the string 'true' from a
// query parameter; the transform normalises both to a boolean.
export const listQuerySchema = z.object({
  includeArchived: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

export const idParamSchema = z.object({ id: z.string().trim().min(1) });

/** GET /api/chapters — return the authenticated user's chapters with room counts. */
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

/** POST /api/chapters — create a new chapter owned by the authenticated user. */
export async function postChapter(req, res, next) {
  try {
    const chapter = await createChapter({ ownerId: req.userId, ...req.body });
    res.status(201).json({ chapter: serializeChapter(chapter) });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/chapters/:id — update name, description, or archived state.
 * Ownership is verified by `getChapterOwnedOrThrow` inside the service; a FORBIDDEN
 * error is thrown if the caller does not own the chapter.
 */
export async function patchChapterHandler(req, res, next) {
  try {
    const chapter = await getChapterOwnedOrThrow(req.params.id, req.userId);
    await patchChapter(chapter, req.body);
    res.json({ chapter: serializeChapter(chapter) });
  } catch (err) {
    next(err);
  }
}
