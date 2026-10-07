import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    pollId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Poll' },
    roomCode: { type: String, required: true, index: true },
    clientId: { type: String, required: true },
    optionId: { type: String, required: true },
  },
  { timestamps: true }
);

// The hard guarantee against vote-spam: one vote per (poll, client). Duplicate
// inserts raise Mongo error 11000, which pollService maps to ALREADY_VOTED.
voteSchema.index({ pollId: 1, clientId: 1 }, { unique: true });

export const Vote = mongoose.models.Vote || mongoose.model('Vote', voteSchema);
