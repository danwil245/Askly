import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    roomCode: { type: String, required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, minlength: 1, maxlength: 100, trim: true },
    status: { type: String, enum: ['active', 'ended'], default: 'active' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    // Written at end. qa/mentor: { questions, answered, polls, votes, participants }
    //                quiz:      { players, questions, topScore }
    summary: { type: mongoose.Schema.Types.Mixed, default: null },
    // Quiz only:
    quizSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    finalLeaderboard: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    interrupted: { type: Boolean, default: false },
    // Linked parent room / session (when quiz is hosted from a mentor room)
    parentRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
    parentSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
    // Quizzes played in this session (for qa / mentor rooms)
    quizzes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

sessionSchema.index({ roomId: 1, startedAt: -1 });

export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
