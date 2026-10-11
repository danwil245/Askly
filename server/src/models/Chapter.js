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

chapterSchema.index({ ownerId: 1, nameLower: 1 }, { unique: true });

export const Chapter = mongoose.models.Chapter || mongoose.model('Chapter', chapterSchema);
