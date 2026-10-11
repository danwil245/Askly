import mongoose from 'mongoose';
import { Chapter } from '../models/Chapter.js';
import { Room } from '../models/Room.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';
import { cleanText } from '../utils/sanitize.js';
import { serializeChapter } from '../utils/serialize.js';

const dupMessage = 'You already have a chapter with that name';

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

  const counts = await Room.aggregate([
    // $match does not auto-cast strings to ObjectId — do it explicitly.
    { $match: { ownerId: new mongoose.Types.ObjectId(String(ownerId)), type: 'mentor' } },
    { $group: { _id: '$chapterId', count: { $sum: 1 } } },
  ]);
  const byChapter = new Map(counts.map((c) => [String(c._id), c.count]));

  return chapters.map((c) => ({
    ...serializeChapter(c),
    roomCount: byChapter.get(String(c._id)) || 0,
  }));
}

export async function getChapterOwnedOrThrow(id, ownerId) {
  requireObjectId(id, 'Chapter');
  const chapter = await Chapter.findById(id);
  if (!chapter) throw appError(ERROR_CODES.NOT_FOUND, 'Chapter not found');
  if (String(chapter.ownerId) !== String(ownerId)) {
    throw appError(ERROR_CODES.FORBIDDEN, 'You do not own this chapter');
  }
  return chapter;
}

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
