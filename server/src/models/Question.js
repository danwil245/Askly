import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    roomCode: { type: String, required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    authorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true }, // denormalized at creation
    text: { type: String, required: true, minlength: 1, maxlength: 280, trim: true },
    upvotes: { type: [String], default: [] }, // userId strings
    upvoteCount: { type: Number, default: 0 },
    answered: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

questionSchema.index({ roomId: 1, createdAt: -1 });
questionSchema.index({ sessionId: 1 });

export const Question =
  mongoose.models.Question || mongoose.model('Question', questionSchema);
