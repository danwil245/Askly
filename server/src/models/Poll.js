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
    roomCode: { type: String, required: true, index: true },
    question: { type: String, required: true, minlength: 1, maxlength: 140, trim: true },
    options: {
      type: [optionSchema],
      validate: {
        validator: (opts) => Array.isArray(opts) && opts.length >= 2 && opts.length <= 6,
        message: 'A poll must have between 2 and 6 options',
      },
    },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
  },
  { timestamps: true }
);

export const Poll = mongoose.models.Poll || mongoose.model('Poll', pollSchema);
