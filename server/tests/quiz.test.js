import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { startTestServer, registerUser, connectClient, emit, waitFor } from './helpers.js';
import { createApp } from '../src/app.js';
import { resetBuckets } from '../src/middleware/antiSpam.js';
import { Session } from '../src/models/Session.js';

const app = createApp();
const auth = (t) => ({ Authorization: `Bearer ${t}` });

const QUIZ = {
  title: 'Capitals',
  questions: [
    {
      text: 'Capital of France?',
      options: [
        { id: 'a', text: 'Paris' },
        { id: 'b', text: 'Berlin' },
      ],
      correctOptionId: 'a',
      timeLimitSec: 30,
    },
    {
      text: 'Capital of Japan?',
      options: [
        { id: 'c', text: 'Tokyo' },
        { id: 'd', text: 'Osaka' },
      ],
      correctOptionId: 'c',
      timeLimitSec: 30,
    },
  ],
};

describe('quiz engine', () => {
  let ctx;
  const sockets = [];
  beforeAll(async () => {
    ctx = await startTestServer();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(() => {
    resetBuckets();
    while (sockets.length) sockets.pop()?.disconnect();
  });
  const track = (s) => {
    sockets.push(s);
    return s;
  };

  // Owner creates + hosts a quiz; returns { token, code }.
  async function hostGame() {
    const { token } = await registerUser(app);
    const created = await request(app).post('/api/quizzes').set(auth(token)).send(QUIZ);
    const quizId = created.body.quiz.id;
    const hosted = await request(app).post(`/api/quizzes/${quizId}/host`).set(auth(token));
    return { token, code: hosted.body.code, quizId };
  }

  async function hostSocket(token, code) {
    const s = track(await connectClient(ctx.url, { token }));
    await emit(s, 'quiz:host:join', { code });
    return s;
  }
  async function playerSocket(code, nickname, clientId) {
    const s = track(await connectClient(ctx.url, { clientId }));
    const res = await emit(s, 'quiz:join', { code, nickname, clientId });
    return { s, res };
  }

  it('REST: creates, lists, hosts, and never exposes the quiz to non-owners', async () => {
    const { token, quizId } = await hostGame();
    const list = await request(app).get('/api/quizzes').set(auth(token));
    expect(list.body.quizzes.map((q) => q.id)).toContain(quizId);

    const other = await registerUser(app);
    const forbidden = await request(app).get(`/api/quizzes/${quizId}`).set(auth(other.token));
    expect(forbidden.status).toBe(403);
  });

  it('runs a full game with flat scoring, ties, and server-authoritative correctness', async () => {
    const { token, code } = await hostGame();
    const host = await hostSocket(token, code);

    const p1 = await playerSocket(code, 'Ana', 'c-ana');
    const p2 = await playerSocket(code, 'Bo', 'c-bo');
    expect(p1.res.ok).toBe(true);
    expect(p2.res.ok).toBe(true);

    // Nickname uniqueness.
    const dup = await playerSocket(code, 'ana', 'c-dup');
    expect(dup.res.ok).toBe(false);
    expect(dup.res.error.code).toBe('NICKNAME_TAKEN');

    // Start → question broadcast, with NO correct answer leaked.
    const q1OnP1 = waitFor(p1.s, 'quiz:question');
    await emit(host, 'quiz:start', {});
    const q1 = await q1OnP1;
    expect(q1.questionId).toBeTruthy();
    expect(q1.text).toContain('France');
    expect(JSON.stringify(q1)).not.toContain('correctOptionId');

    // A latecomer during the game is rejected.
    const late = await playerSocket(code, 'Late', 'c-late');
    expect(late.res.error.code).toBe('GAME_STARTED');

    // Answers: Ana correct, Bo wrong. Reveal fires when both have answered.
    const revealOnP1 = waitFor(p1.s, 'quiz:reveal');
    const resultOnP1 = waitFor(p1.s, 'quiz:result');
    expect((await emit(p1.s, 'quiz:answer', { questionId: q1.questionId, optionId: 'a' })).data).toEqual({
      received: true,
    });
    // Duplicate answer rejected.
    const dupAns = await emit(p1.s, 'quiz:answer', { questionId: q1.questionId, optionId: 'b' });
    expect(dupAns.error.code).toBe('ALREADY_ANSWERED');

    await emit(p2.s, 'quiz:answer', { questionId: q1.questionId, optionId: 'b' });

    const reveal = await revealOnP1;
    expect(reveal.correctOptionId).toBe('a');
    const result = await resultOnP1;
    expect(result).toMatchObject({ correct: true, pointsEarned: 100, totalScore: 100 });

    // Answering after reveal is rejected.
    const tooLate = await emit(p2.s, 'quiz:answer', { questionId: q1.questionId, optionId: 'a' });
    expect(tooLate.error.code).toBe('WRONG_PHASE');

    // Next → leaderboard, Next → question 2.
    await emit(host, 'quiz:next', {}); // reveal → leaderboard
    const q2OnP1 = waitFor(p1.s, 'quiz:question');
    await emit(host, 'quiz:next', {}); // leaderboard → question 2
    const q2 = await q2OnP1;
    expect(q2.text).toContain('Japan');

    // Bo correct, Ana wrong → both end on 100 (tie).
    await emit(p1.s, 'quiz:answer', { questionId: q2.questionId, optionId: 'd' });
    await emit(p2.s, 'quiz:answer', { questionId: q2.questionId, optionId: 'c' });

    const finished = waitFor(host, 'quiz:finished');
    await emit(host, 'quiz:next', {}); // reveal → leaderboard
    await emit(host, 'quiz:next', {}); // leaderboard → finished
    const final = await finished;
    const board = final.leaderboard;
    expect(board).toHaveLength(2);
    expect(board.every((p) => p.score === 100)).toBe(true);
    expect(board.every((p) => p.rank === 1)).toBe(true); // ties share rank

    // Persisted: past games list + final leaderboard on the session.
    const games = await request(app).get('/api/quizzes/games').set(auth(token));
    expect(games.body.games.length).toBeGreaterThanOrEqual(1);
    expect(games.body.games[0].summary.topScore).toBe(100);
    const sess = await Session.findById(games.body.games[0].sessionId).lean();
    expect(sess.status).toBe('ended');
    expect(sess.finalLeaderboard).toHaveLength(2);
  });

  it('restores a player’s score on rejoin with the same clientId', async () => {
    const { token, code } = await hostGame();
    const host = await hostSocket(token, code);
    const p = await playerSocket(code, 'Cy', 'c-cy');

    const qOnP = waitFor(p.s, 'quiz:question');
    await emit(host, 'quiz:start', {});
    const q = await qOnP;
    await emit(p.s, 'quiz:answer', { questionId: q.questionId, optionId: 'a' }); // correct → 100

    // Disconnect and rejoin with the same clientId.
    p.s.disconnect();
    const rejoin = await playerSocket(code, 'Cy', 'c-cy');
    expect(rejoin.res.ok).toBe(true);
    expect(rejoin.res.data.state.me.score).toBe(100);
  });

  it('kicks a player', async () => {
    const { token, code } = await hostGame();
    const host = await hostSocket(token, code);
    const p = await playerSocket(code, 'Dee', 'c-dee');

    const kickedEvent = waitFor(p.s, 'quiz:kicked');
    const res = await emit(host, 'quiz:kick', { playerId: p.res.data.player.id });
    expect(res.ok).toBe(true);
    await kickedEvent; // player is notified
  });

  it('hosts a quiz linked to a course room and saves quiz questions & results to the room session', async () => {
    const { token } = await registerUser(app);
    // Create course/qa room
    const roomRes = await request(app)
      .post('/api/rooms')
      .set(auth(token))
      .send({ type: 'qa', title: 'Data Structures' });
    expect(roomRes.status).toBe(201);
    const parentCode = roomRes.body.room.code;
    const parentSessionId = roomRes.body.currentSession.id;

    // Create quiz
    const quizRes = await request(app).post('/api/quizzes').set(auth(token)).send(QUIZ);
    const quizId = quizRes.body.quiz.id;

    // Host quiz linked to room
    const hostRes = await request(app)
      .post(`/api/quizzes/${quizId}/host`)
      .set(auth(token))
      .send({ parentRoomCode: parentCode });
    expect(hostRes.status).toBe(201);
    const quizCode = hostRes.body.code;

    // Connect host & player
    const host = await hostSocket(token, quizCode);
    const p1 = await playerSocket(quizCode, 'Student1', 'c-st1');
    expect(p1.res.ok).toBe(true);

    // Play 1st question
    const q1Promise = waitFor(p1.s, 'quiz:question');
    await emit(host, 'quiz:start', {});
    const q1 = await q1Promise;
    await emit(p1.s, 'quiz:answer', { questionId: q1.questionId, optionId: 'a' });

    // End game
    const finishedPromise = waitFor(host, 'quiz:finished');
    await emit(host, 'quiz:end', {});
    await finishedPromise;

    // Fetch parent session report
    const reportRes = await request(app)
      .get(`/api/sessions/${parentSessionId}`)
      .set(auth(token));
    expect(reportRes.status).toBe(200);
    const report = reportRes.body;

    // Quizzes in session
    expect(report.quizzes).toBeDefined();
    expect(report.quizzes.length).toBe(1);
    expect(report.quizzes[0].title).toBe('Capitals');
    expect(report.quizzes[0].questions.length).toBe(2);
    expect(report.quizzes[0].status).toBe('ended');

    // Questions saved to the room
    const quizQuestions = report.questions.filter((q) => q.authorName?.includes('Quiz'));
    expect(quizQuestions.length).toBe(2);
    expect(quizQuestions[0].text).toContain('[Quiz Question]');
  });
});
