import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, minlength: 1, maxlength: 80, trim: true },
    // sha256 of the host token — the raw token is returned exactly once at creation.
    hostTokenHash: { type: String, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
  },
  { timestamps: true }
);

// Guard against re-compilation when test files reload the module graph.
export const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);
