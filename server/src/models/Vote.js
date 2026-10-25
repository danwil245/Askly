/**
 * Anti-Spamming Security: Vote Model
 * Compound unique index { pollId: 1, userId: 1 } preventing duplicate voting at the database layer.
 */
import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    pollId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Poll' },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    optionId: { type: String, required: true },
  },
  { timestamps: true }
);

// Anti-spam guarantee: The hard guarantee against vote-spam: one vote per (poll, user). Duplicate inserts
// raise Mongo error 11000, which pollService maps to ALREADY_VOTED.
voteSchema.index({ pollId: 1, userId: 1 }, { unique: true });

export const Vote = mongoose.models.Vote || mongoose.model('Vote', voteSchema);
