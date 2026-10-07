import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, index: true },
    text: { type: String, required: true, minlength: 1, maxlength: 280, trim: true },
    authorId: { type: String, required: true }, // anonymous clientId
    upvotes: { type: [String], default: [] }, // clientIds who upvoted
    upvoteCount: { type: Number, default: 0 }, // kept in sync atomically with upvotes
    answered: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

questionSchema.index({ roomCode: 1, createdAt: -1 });

export const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);
