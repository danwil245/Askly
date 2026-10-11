import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { createRoom } from '../src/services/roomService.js';
import { createQuestion, toggleUpvote } from '../src/services/questionService.js';
import { createPoll, recordVote } from '../src/services/pollService.js';
import { setAnswered, setHidden } from '../src/services/moderationService.js';
import { getSnapshot } from '../src/services/analyticsService.js';

const oid = () => new mongoose.Types.ObjectId();

describe('analyticsService.getSnapshot (v2)', () => {
  let code;
  const owner = oid();
  const alice = oid();
  const bob = oid();
  const carol = oid();
  const dave = oid();
  const erin = oid();

  beforeEach(async () => {
    const { room } = await createRoom({ ownerId: owner, type: 'qa', title: 'Analytics Room' });
    code = room.code;
  });

  const ask = (text, author, name) =>
    createQuestion({ roomCode: code, text, authorUserId: author, authorName: name });

  it('aggregates totals, answer rate, participants and poll stats', async () => {
    const { question: q1 } = await ask('First?', alice, 'Alice');
    await ask('Second?', bob, 'Bob');
    const { question: q3 } = await ask('Third?', alice, 'Alice');

    await toggleUpvote({ roomCode: code, questionId: q1._id, userId: carol });
    await toggleUpvote({ roomCode: code, questionId: q1._id, userId: dave });
    await toggleUpvote({ roomCode: code, questionId: q3._id, userId: carol });

    await setAnswered({ roomCode: code, questionId: q1._id, answered: true });
    await setHidden({ roomCode: code, questionId: q3._id, hidden: true });

    const poll = await createPoll({ roomCode: code, question: 'Pick one', options: ['A', 'B'] });
    const optA = poll.options[0].id;
    await recordVote({ roomCode: code, pollId: poll._id, optionId: optA, userId: alice });
    await recordVote({ roomCode: code, pollId: poll._id, optionId: optA, userId: erin });

    const snap = await getSnapshot(code);

    expect(snap.totals.questions).toBe(3);
    expect(snap.totals.answered).toBe(1);
    expect(snap.totals.hidden).toBe(1);
    expect(snap.totals.upvotes).toBe(3);
    expect(snap.totals.polls).toBe(1);
    expect(snap.totals.votes).toBe(2);
    // authors alice,bob + upvoters carol,dave + voters alice,erin = 5 distinct
    expect(snap.totals.uniqueParticipants).toBe(5);
    expect(snap.answerRate).toBe(50);

    expect(snap.polls[0].totalVotes).toBe(2);
    expect(snap.polls[0].options.find((o) => o.text === 'A').percent).toBe(100);

    expect(snap.topQuestions[0].text).toBe('First?');
    expect(snap.topQuestions[0].upvoteCount).toBe(2);

    const totalBucketed = snap.questionsOverTime.reduce((s, b) => s + b.count, 0);
    expect(totalBucketed).toBe(3);
  });

  it('returns a zeroed snapshot for an empty room', async () => {
    const snap = await getSnapshot(code);
    expect(snap.totals.questions).toBe(0);
    expect(snap.totals.uniqueParticipants).toBe(0);
    expect(snap.answerRate).toBe(0);
    expect(snap.polls).toEqual([]);
  });

  it('scopes analytics to a single session when sessionId is given', async () => {
    await ask('Only session one', alice, 'Alice');
    const snapAll = await getSnapshot(code);
    expect(snapAll.totals.questions).toBe(1);

    // A different (random) session id should see nothing.
    const snapOther = await getSnapshot(code, { sessionId: oid() });
    expect(snapOther.totals.questions).toBe(0);
  });
});
