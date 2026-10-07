import { describe, it, expect, beforeEach } from 'vitest';
import { createRoom } from '../src/services/roomService.js';
import { createQuestion, toggleUpvote } from '../src/services/questionService.js';
import { createPoll, recordVote } from '../src/services/pollService.js';
import { setAnswered, setHidden } from '../src/services/moderationService.js';
import { getSnapshot } from '../src/services/analyticsService.js';

describe('analyticsService.getSnapshot', () => {
  let code;
  beforeEach(async () => {
    ({ code } = await createRoom({ title: 'Analytics Room' }));
  });

  it('aggregates totals, answer rate, participants, and poll stats', async () => {
    // Three questions from two authors.
    const q1 = await createQuestion({ roomCode: code, text: 'First?', authorId: 'alice' });
    await createQuestion({ roomCode: code, text: 'Second?', authorId: 'bob' });
    const q3 = await createQuestion({ roomCode: code, text: 'Third?', authorId: 'alice' });

    // Upvotes from distinct clients.
    await toggleUpvote({ roomCode: code, questionId: q1._id, clientId: 'carol' });
    await toggleUpvote({ roomCode: code, questionId: q1._id, clientId: 'dave' });
    await toggleUpvote({ roomCode: code, questionId: q3._id, clientId: 'carol' });

    await setAnswered({ roomCode: code, questionId: q1._id, answered: true });
    await setHidden({ roomCode: code, questionId: q3._id, hidden: true });

    // A poll with two voters.
    const poll = await createPoll({
      roomCode: code,
      question: 'Pick one',
      options: ['A', 'B'],
    });
    const optA = poll.options[0].id;
    await recordVote({ roomCode: code, pollId: poll._id, optionId: optA, clientId: 'alice' });
    await recordVote({ roomCode: code, pollId: poll._id, optionId: optA, clientId: 'erin' });

    const snap = await getSnapshot(code);

    expect(snap.totals.questions).toBe(3);
    expect(snap.totals.answered).toBe(1);
    expect(snap.totals.hidden).toBe(1);
    expect(snap.totals.upvotes).toBe(3);
    expect(snap.totals.polls).toBe(1);
    expect(snap.totals.votes).toBe(2);

    // Participants: authors alice/bob + upvoters carol/dave + voters alice/erin = 5 distinct.
    expect(snap.totals.uniqueParticipants).toBe(5);

    // Answer rate = answered(1) / visible(2 — q3 is hidden) = 50%.
    expect(snap.answerRate).toBe(50);

    // Poll stats.
    expect(snap.polls).toHaveLength(1);
    expect(snap.polls[0].totalVotes).toBe(2);
    const aOpt = snap.polls[0].options.find((o) => o.text === 'A');
    expect(aOpt.votes).toBe(2);
    expect(aOpt.percent).toBe(100);

    // topQuestions sorted by upvotes desc (q1 has 2).
    expect(snap.topQuestions[0].text).toBe('First?');
    expect(snap.topQuestions[0].upvoteCount).toBe(2);

    // questionsOverTime buckets exist.
    const totalBucketed = snap.questionsOverTime.reduce((s, b) => s + b.count, 0);
    expect(totalBucketed).toBe(3);
  });

  it('returns zeroed snapshot for an empty room', async () => {
    const snap = await getSnapshot(code);
    expect(snap.totals.questions).toBe(0);
    expect(snap.totals.uniqueParticipants).toBe(0);
    expect(snap.answerRate).toBe(0);
    expect(snap.polls).toEqual([]);
  });
});
