import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // generated server-side
    text: { type: String, required: true, minlength: 1, maxlength: 80, trim: true },
    votes: { type: Number, default: 0 },
  },
  { _id: false }
);

const pollSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    roomCode: { type: String, required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    question: { type: String, required: true, minlength: 1, maxlength: 140, trim: true },
    options: {
      type: [optionSchema],
      validate: {
        validator: (opts) => Array.isArray(opts) && opts.length >= 2 && opts.length <= 6,
        message: 'A poll must have between 2 and 6 options',
      },
    },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    // Null means the host closes this poll manually. A concrete timestamp is enforced
    // on the server so a client-side countdown can never accept a late vote.
    closesAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Poll = mongoose.models.Poll || mongoose.model('Poll', pollSchema);
