/**
 * Room model — a named space where live Q&A sessions or mentor classes take place.
 *
 * Three room types are supported:
 *   'qa'     — one-shot speaker Q&A; anonymous audience, no login required.
 *   'mentor' — persistent course room owned by a mentor; audience must be logged in.
 *              Requires a valid `chapterId` pointing to a Chapter owned by the same user.
 *   'quiz'   — Kahoot-style live quiz arena; linked via `quizId`.
 *
 * Mentor room persistence:
 *   A Room document is permanent and reusable. Opening it creates a new Session;
 *   closing it ends the Session and writes a summary. All Questions and Polls are
 *   stored against the Room (_id), not the Session, so they persist across every
 *   reopen. `currentSessionId` always points to the active Session, or is null
 *   when the room is closed.
 *
 * Compound index { ownerId, type, chapterId } supports efficient chapter-scoped
 * room listing used by `listMyRooms()` in roomService.
 */
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

// Supports chapter-scoped mentor room queries: GET /api/rooms/mine?type=mentor&chapterId=...
roomSchema.index({ ownerId: 1, type: 1, chapterId: 1 });

export const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);
