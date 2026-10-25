/**
 * Chapter model — top-level organizational unit for the Mentor Rooms module.
 *
 * A Chapter represents a course or subject (e.g. "Data Structures") owned by a
 * single mentor. Chapters act as containers for reusable mentor-type Rooms.
 * One mentor can have many chapters; each chapter can hold many mentor rooms.
 *
 * Relationships:
 *   Chapter (1) → Room (many)   via Room.chapterId
 *   Chapter (many) → User (1)   via Chapter.ownerId
 *
 * Case-insensitive uniqueness is enforced through the `nameLower` field and a
 * compound unique index `{ ownerId, nameLower }`. Two different owners may share
 * the same chapter name; a single owner may not.
 *
 * Archiving (`archived: true`) soft-deletes a chapter from the default listing
 * without removing its rooms or historical session data.
 */
import mongoose from 'mongoose';

const chapterSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, minlength: 1, maxlength: 80, trim: true },
    // Lowercase copy for the per-owner unique index (case-insensitive uniqueness).
    nameLower: { type: String, required: true },
    description: { type: String, maxlength: 300, default: '', trim: true },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Per-owner unique name constraint enforced at the database level.
// mongo error code 11000 (duplicate key) is caught by the service layer and
// converted to a VALIDATION_ERROR with a user-friendly message.
chapterSchema.index({ ownerId: 1, nameLower: 1 }, { unique: true });

export const Chapter = mongoose.models.Chapter || mongoose.model('Chapter', chapterSchema);
