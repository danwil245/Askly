/**
 * Person 3 — Anti-Spamming Security: PlayerAnswer Model
 * Compound unique index { sessionId: 1, playerId: 1, questionId: 1 } preventing double submissions in quizzes.
 */
import mongoose from 'mongoose';

const playerAnswerSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    questionId: { type: String, required: true },
    optionId: { type: String, required: true },
    correct: { type: Boolean, required: true },
    answeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Person 3 anti-spam: One answer per player per question — the DB backstop against double-answering.
playerAnswerSchema.index({ sessionId: 1, playerId: 1, questionId: 1 }, { unique: true });

export const PlayerAnswer =
  mongoose.models.PlayerAnswer || mongoose.model('PlayerAnswer', playerAnswerSchema);
