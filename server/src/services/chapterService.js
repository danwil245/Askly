/**
 * Chapter service — business logic for creating, listing, updating, and archiving
 * chapters in the Mentor Rooms module.
 *
 * Responsibilities:
 *   - Enforce per-owner case-insensitive name uniqueness (backed by a DB unique index).
 *   - Aggregate and attach `roomCount` (mentor rooms only) when listing chapters.
 *   - Provide ownership verification before allowing updates.
 *   - Keep `nameLower` in sync with `name` on every write.
 *
 * This service does not handle HTTP concerns; it is called by chapters.controller.js.
 * It depends on chapterService (Chapter model), roomService aggregation (Room model),
 * and shared utilities: errors, ids, sanitize, serialize.
 */
import mongoose from 'mongoose';
import { Chapter } from '../models/Chapter.js';
import { Room } from '../models/Room.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';
import { cleanText } from '../utils/sanitize.js';
import { serializeChapter } from '../utils/serialize.js';

// Shared duplicate-name user message, referenced in both create and patch error paths.
const dupMessage = 'You already have a chapter with that name';

/**
 * Create a new chapter for the given owner.
 * `name` is sanitized and stored in both its display form and as `nameLower` for
 * the unique index. A MongoDB 11000 (duplicate key) error is translated to a
 * VALIDATION_ERROR so the client receives a friendly message.
 */
export async function createChapter({ ownerId, name, description = '' }) {
  const cleanName = cleanText(name, { singleLine: true });
  try {
    const chapter = await Chapter.create({
      ownerId,
      name: cleanName,
      nameLower: cleanName.toLowerCase(),
      description: cleanText(description),
    });
    return chapter;
  } catch (err) {
    if (err?.code === 11000) throw appError(ERROR_CODES.VALIDATION_ERROR, dupMessage);
    throw err;
  }
}

/** List the owner's chapters (optionally including archived) with room counts. */
export async function listChapters(ownerId, { includeArchived = false } = {}) {
  const q = { ownerId };
  if (!includeArchived) q.archived = false;
  const chapters = await Chapter.find(q).sort({ createdAt: -1 }).lean();

  // Count mentor rooms per chapter using an aggregation.
  // ObjectId must be cast explicitly because $match does not auto-cast strings.
  const counts = await Room.aggregate([
    // $match does not auto-cast strings to ObjectId — do it explicitly.
    { $match: { ownerId: new mongoose.Types.ObjectId(String(ownerId)), type: 'mentor' } },
    { $group: { _id: '$chapterId', count: { $sum: 1 } } },
  ]);
  // Build a lookup map: chapterId string → count.
  const byChapter = new Map(counts.map((c) => [String(c._id), c.count]));

  return chapters.map((c) => ({
    ...serializeChapter(c),
    roomCount: byChapter.get(String(c._id)) || 0,
  }));
}

/**
 * Fetch a chapter by ID and assert the caller owns it.
 * Throws NOT_FOUND or FORBIDDEN — callers should not swallow these errors.
 */
export async function getChapterOwnedOrThrow(id, ownerId) {
  requireObjectId(id, 'Chapter');
  const chapter = await Chapter.findById(id);
  if (!chapter) throw appError(ERROR_CODES.NOT_FOUND, 'Chapter not found');
  if (String(chapter.ownerId) !== String(ownerId)) {
    throw appError(ERROR_CODES.FORBIDDEN, 'You do not own this chapter');
  }
  return chapter;
}

/**
 * Apply a partial update to an existing chapter document.
 * Keeps `nameLower` in sync whenever `name` changes.
 * A MongoDB 11000 on save (duplicate name) is converted to VALIDATION_ERROR.
 */
export async function patchChapter(chapter, { name, description, archived }) {
  if (name !== undefined) {
    const cleanName = cleanText(name, { singleLine: true });
    chapter.name = cleanName;
    chapter.nameLower = cleanName.toLowerCase();
  }
  if (description !== undefined) chapter.description = cleanText(description);
  if (archived !== undefined) chapter.archived = !!archived;
  try {
    await chapter.save();
  } catch (err) {
    if (err?.code === 11000) throw appError(ERROR_CODES.VALIDATION_ERROR, dupMessage);
    throw err;
  }
  return chapter;
}
