import { Session } from '../models/Session.js';
import { Room } from '../models/Room.js';
import { Question } from '../models/Question.js';
import { Poll } from '../models/Poll.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';
import { cleanText } from '../utils/sanitize.js';
import { serializeSession } from '../utils/serialize.js';

export async function getSessionOrThrow(id) {
  requireObjectId(id, 'Session');
  const session = await Session.findById(id);
  if (!session) throw appError(ERROR_CODES.NOT_FOUND, 'Session not found');
  return session;
}

export async function listSessionsForRoom(roomId) {
  const sessions = await Session.find({ roomId }).sort({ startedAt: -1 }).lean();
  return sessions.map((s) => ({ ...serializeSession(s), summary: s.summary || null }));
}

export async function renameSession(session, name) {
  const clean = cleanText(name, { singleLine: true });
  if (!clean) throw appError(ERROR_CODES.VALIDATION_ERROR, 'Session name is required');
  session.name = clean.slice(0, 100);
  await session.save();
  return session;
}

/**
 * Full session report. For qa/mentor: questions (with author names), polls with
 * results, and totals. For quiz: the stored snapshot, final leaderboard, and
 * per-question stats (populated in Phase 6).
 */
export async function getSessionReport(session) {
  const room = await Room.findById(session.roomId).lean();

  if (room?.type === 'quiz') {
    return {
      session: { ...serializeSession(session), summary: session.summary || null },
      room: { code: room.code, title: room.title, type: room.type },
      quiz: {
        snapshot: session.quizSnapshot || null,
        finalLeaderboard: session.finalLeaderboard || [],
        interrupted: !!session.interrupted,
      },
    };
  }

  const [questions, polls] = await Promise.all([
    Question.find({ sessionId: session._id }).sort({ upvoteCount: -1, createdAt: 1 }).lean(),
    Poll.find({ sessionId: session._id }).sort({ createdAt: 1 }).lean(),
  ]);

  return {
    session: { ...serializeSession(session), summary: session.summary || null },
    room: { code: room?.code, title: room?.title, type: room?.type },
    questions: questions.map((q) => ({
      id: String(q._id),
      text: q.text,
      authorName: q.authorName,
      upvoteCount: q.upvoteCount || 0,
      answered: !!q.answered,
      hidden: !!q.hidden,
      createdAt: q.createdAt,
    })),
    polls: polls.map((p) => {
      const total = (p.options || []).reduce((s, o) => s + (o.votes || 0), 0);
      return {
        id: String(p._id),
        question: p.question,
        status: p.status,
        totalVotes: total,
        options: (p.options || []).map((o) => ({
          text: o.text,
          votes: o.votes || 0,
          percent: total ? Math.round(((o.votes || 0) / total) * 1000) / 10 : 0,
        })),
      };
    }),
    quizzes: (session.quizzes || []).map((qz) => ({
      quizId: qz.quizId,
      code: qz.code,
      title: qz.title,
      description: qz.description,
      status: qz.status,
      questionCount: qz.questions?.length || qz.questionCount || 0,
      questions: (qz.questions || []).map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options || [],
        correctOptionId: q.correctOptionId,
        timeLimitSec: q.timeLimitSec,
      })),
      finalLeaderboard: qz.finalLeaderboard || [],
      summary: qz.summary || null,
      startedAt: qz.startedAt,
      endedAt: qz.endedAt || null,
    })),
  };
}
