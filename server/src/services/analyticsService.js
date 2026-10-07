import { Question } from '../models/Question.js';
import { Poll } from '../models/Poll.js';
import { Vote } from '../models/Vote.js';
import { getRoomOrThrow } from './roomService.js';

/**
 * Area C — analytics. Computed with MongoDB aggregation pipelines rather than loading
 * documents into memory. Returns the snapshot shape described in spec section 11.
 */
export async function getSnapshot(code) {
  await getRoomOrThrow(code); // 404 if missing

  const [questionAgg, upvoteParticipants, pollDocs, voteAgg, voteParticipants, overTime] =
    await Promise.all([
      // Question totals in a single pass.
      Question.aggregate([
        { $match: { roomCode: code } },
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
      // Distinct clientIds who asked or upvoted.
      Question.aggregate([
        { $match: { roomCode: code } },
        { $project: { ids: { $concatArrays: [['$authorId'], { $ifNull: ['$upvotes', []] }] } } },
        { $unwind: '$ids' },
        { $group: { _id: '$ids' } },
      ]),
      Poll.find({ roomCode: code }).sort({ createdAt: 1 }).lean(),
      Vote.aggregate([{ $match: { roomCode: code } }, { $count: 'votes' }]),
      Vote.aggregate([{ $match: { roomCode: code } }, { $group: { _id: '$clientId' } }]),
      // Questions bucketed per minute.
      Question.aggregate([
        { $match: { roomCode: code } },
        {
          $group: {
            _id: {
              $dateTrunc: { date: '$createdAt', unit: 'minute' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

  const qStats = questionAgg[0] || {
    questions: 0,
    answered: 0,
    hidden: 0,
    visible: 0,
    upvotes: 0,
  };
  const votesTotal = voteAgg[0]?.votes || 0;

  // uniqueParticipants: distinct clientIds across questions, upvotes, and votes.
  const participantSet = new Set([
    ...upvoteParticipants.map((p) => p._id),
    ...voteParticipants.map((p) => p._id),
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
      // Participation relative to the room's unique participants.
      participationRate: participantSet.size
        ? Math.round((totalVotes / participantSet.size) * 1000) / 10
        : 0,
    };
  });

  const topQuestions = await Question.find({ roomCode: code })
    .sort({ upvoteCount: -1, createdAt: 1 })
    .limit(5)
    .lean();

  return {
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
