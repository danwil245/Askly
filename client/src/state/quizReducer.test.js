import { describe, it, expect } from 'vitest';
import { quizReducer, initialQuizState } from './quizReducer.js';

const base = () => ({ ...initialQuizState });

describe('quizReducer', () => {
  it('starts a question and clears prior reveal/result + records skew', () => {
    const now = Date.now();
    const s = quizReducer(
      { ...base(), reveal: { x: 1 }, myResult: { correct: true } },
      {
        type: 'QUESTION',
        payload: {
          index: 0,
          total: 3,
          questionId: 'q1',
          text: 'Q?',
          options: [{ id: 'a', text: 'A' }],
          timeLimitSec: 20,
          endsAt: now + 20000,
          serverNow: now + 1000,
        },
      }
    );
    expect(s.phase).toBe('question');
    expect(s.question.questionId).toBe('q1');
    expect(s.reveal).toBeNull();
    expect(s.myResult).toBeNull();
    expect(Math.abs(s.skew - 1000)).toBeLessThan(50);
  });

  it('records a personal result and updates my score', () => {
    let s = { ...base(), me: { nickname: 'Ana', score: 0 } };
    s = quizReducer(s, {
      type: 'RESULT',
      payload: { correct: true, pointsEarned: 100, totalScore: 100 },
    });
    expect(s.myResult.correct).toBe(true);
    expect(s.me.score).toBe(100);
  });

  it('tracks answer counts for the host', () => {
    const s = quizReducer(base(), { type: 'ANSWER_COUNT', answered: 3, total: 5 });
    expect(s.answerCount).toEqual({ answered: 3, total: 5 });
  });

  it('stores leaderboard with your rank/score', () => {
    const s = quizReducer(base(), {
      type: 'LEADERBOARD',
      payload: { top: [{ rank: 1, nickname: 'Ana', score: 100 }], total: 1, yourRank: 1, yourScore: 100 },
    });
    expect(s.phase).toBe('leaderboard');
    expect(s.leaderboard.yourRank).toBe(1);
  });

  it('captures the final leaderboard and kicked state', () => {
    let s = quizReducer(base(), { type: 'FINISHED', payload: { leaderboard: [{ rank: 1 }] } });
    expect(s.phase).toBe('finished');
    expect(s.finalLeaderboard).toHaveLength(1);
    s = quizReducer(s, { type: 'KICKED' });
    expect(s.kicked).toBe(true);
  });
});
