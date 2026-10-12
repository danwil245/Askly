import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['qa', 'mentor', 'quiz'], required: true },
    title: { type: String, required: true, minlength: 1, maxlength: 80, trim: true },
    // Required for mentor rooms; null otherwise.
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', default: null },
    // Only set for quiz rooms.
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', default: null },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    currentSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
    // For quiz rooms launched from a mentor/qa room:
    parentRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
    // If a quiz is currently running in this room:
    activeQuizCode: { type: String, default: null },
    settings: {
      // 'host': audience sees "Anonymous", host sees the asker's name. 'all': everyone sees names.
      showAuthorNames: { type: String, enum: ['host', 'all'], default: 'host' },
    },
  },
  { timestamps: true }
);

roomSchema.index({ ownerId: 1, type: 1, chapterId: 1 });

export const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);
