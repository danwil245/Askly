import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, minlength: 1, maxlength: 100, trim: true },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, minlength: 1, maxlength: 200, trim: true },
    options: {
      type: [optionSchema],
      validate: {
        validator: (opts) => Array.isArray(opts) && opts.length >= 2 && opts.length <= 4,
        message: 'A question must have between 2 and 4 options',
      },
    },
    correctOptionId: { type: String, required: true },
    timeLimitSec: { type: Number, min: 5, max: 120, default: 20 },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, minlength: 1, maxlength: 100, trim: true },
    description: { type: String, maxlength: 300, default: '', trim: true },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (qs) => Array.isArray(qs) && qs.length >= 1 && qs.length <= 50,
        message: 'A quiz must have between 1 and 50 questions',
      },
    },
  },
  { timestamps: true }
);

export const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);
