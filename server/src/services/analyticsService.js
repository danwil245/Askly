import { Question } from '../models/Question.js';
import { Poll } from '../models/Poll.js';
import { Vote } from '../models/Vote.js';
import { getRoomByCodeOrThrow } from './roomService.js';
import { requireObjectId } from '../utils/ids.js';

/**
 * Analytics via aggregation pipelines. Scoped to a single session when `sessionId` is
 * given, otherwise room-wide (all sessions). Shape matches v1 section 11 plus session
 * scoping (v2 section 7).
 */
export async function getSnapshot(code, { sessionId } = {}) {
  const room = await getRoomByCodeOrThrow(code);
  if (sessionId) requireObjectId(sessionId, 'Session');

  const match = sessionId ? { roomId: room._id, sessionId } : { roomId: room._id };
  const voteMatch = match;

  const [questionAgg, qParticipants, pollDocs, voteAgg, voteParticipants, overTime, topQuestions] =
    await Promise.all([
      Question.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            questions: { $sum: 1 },
            answered: { $sum: { $cond: ['$answered', 1, 0] } },
            hidden: { $sum: { $cond: ['$hidden', 1, 0] } },
            visible: { $sum: { $cond: ['$hidden', 0, 1] } },
            upvotes: { $sum: '$upvoteCount' },
          },
        },
      ]),
      Question.aggregate([
        { $match: match },
        {
          $project: {
            ids: {
              $concatArrays: [[{ $toString: '$authorUserId' }], { $ifNull: ['$upvotes', []] }],
            },
          },
        },
        { $unwind: '$ids' },
        { $group: { _id: '$ids' } },
      ]),
      Poll.find(match).sort({ createdAt: 1 }).lean(),
      Vote.aggregate([{ $match: voteMatch }, { $count: 'votes' }]),
      Vote.aggregate([{ $match: voteMatch }, { $group: { _id: '$userId' } }]),
      Question.aggregate([
        { $match: match },
        { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'minute' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Question.find(match).sort({ upvoteCount: -1, createdAt: 1 }).limit(5).lean(),
    ]);

  const qStats = questionAgg[0] || { questions: 0, answered: 0, hidden: 0, visible: 0, upvotes: 0 };
  const votesTotal = voteAgg[0]?.votes || 0;

  const participantSet = new Set([
    ...qParticipants.map((p) => String(p._id)),
    ...voteParticipants.map((p) => String(p._id)),
  ]);

  const polls = pollDocs.map((poll) => {
    const totalVotes = (poll.options || []).reduce((s, o) => s + (o.votes || 0), 0);
    return {
      id: String(poll._id),
      question: poll.question,
      status: poll.status,
      totalVotes,
      options: (poll.options || []).map((o) => ({
        text: o.text,
        votes: o.votes || 0,
        percent: totalVotes ? Math.round(((o.votes || 0) / totalVotes) * 1000) / 10 : 0,
      })),
      participationRate: participantSet.size
        ? Math.round((totalVotes / participantSet.size) * 1000) / 10
        : 0,
    };
  });

  return {
    scope: sessionId ? 'session' : 'room',
    sessionId: sessionId ? String(sessionId) : null,
    totals: {
      questions: qStats.questions,
      answered: qStats.answered,
      hidden: qStats.hidden,
      upvotes: qStats.upvotes,
      polls: pollDocs.length,
      votes: votesTotal,
      uniqueParticipants: participantSet.size,
    },
    answerRate: qStats.visible ? Math.round((qStats.answered / qStats.visible) * 1000) / 10 : 0,
    topQuestions: topQuestions.map((q) => ({
      id: String(q._id),
      text: q.text,
      upvoteCount: q.upvoteCount || 0,
      answered: !!q.answered,
    })),
    questionsOverTime: overTime.map((b) => ({ minute: b._id, count: b.count })),
    polls,
  };
}
