import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    clientId: { type: String, required: true }, // anonymous reconnect identity
    nickname: { type: String, required: true, minlength: 2, maxlength: 20, trim: true },
    nicknameLower: { type: String, required: true },
    score: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
    kicked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One nickname per game (case-insensitive).
playerSchema.index({ sessionId: 1, nicknameLower: 1 }, { unique: true });
playerSchema.index({ sessionId: 1, clientId: 1 });

export const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);
