import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  startTestServer,
  registerUser,
  createRoom,
  connectClient,
  emit,
  waitFor,
} from './helpers.js';
import { createApp } from '../src/app.js';
import { resetBuckets } from '../src/middleware/antiSpam.js';
import { env } from '../src/config/env.js';

const app = createApp();

describe('socket contract (v2)', () => {
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

  // Owner + room + an audience user, the common setup.
  async function setup({ title = 'Socket Room', showAuthorNames } = {}) {
    const owner = await registerUser(app, { name: 'Owner' });
    const { code } = await createRoom(app, owner.token, { title });
    const audience = await registerUser(app, { name: 'Audience' });
    void showAuthorNames;
    return { owner, audience, code };
  }

  it('sets isHost from ownership and requires auth for qa rooms', async () => {
    const { owner, audience, code } = await setup();

    const hostSock = track(await connectClient(ctx.url, { token: owner.token }));
    const hostJoin = await emit(hostSock, 'room:join', { code });
    expect(hostJoin.ok).toBe(true);
    expect(hostJoin.data.isHost).toBe(true);
    expect(hostJoin.data.room.type).toBe('qa');
    expect(Array.isArray(hostJoin.data.sessions)).toBe(true);

    const audSock = track(await connectClient(ctx.url, { token: audience.token }));
    const audJoin = await emit(audSock, 'room:join', { code });
    expect(audJoin.ok).toBe(true);
    expect(audJoin.data.isHost).toBe(false);

    // Anonymous (no token) is rejected.
    const anon = track(await connectClient(ctx.url, {}));
    const anonJoin = await emit(anon, 'room:join', { code });
    expect(anonJoin.ok).toBe(false);
    expect(anonJoin.error.code).toBe('UNAUTHENTICATED');
  });

  it('broadcasts question:new and hides author identity from the audience by default', async () => {
    const { owner, audience, code } = await setup();
    const hostSock = track(await connectClient(ctx.url, { token: owner.token }));
    const audSock = track(await connectClient(ctx.url, { token: audience.token }));
    await emit(hostSock, 'room:join', { code });
    await emit(audSock, 'room:join', { code });

    const audReceived = waitFor(audSock, 'question:new');
    const hostReceived = waitFor(hostSock, 'question:new');
    const ack = await emit(audSock, 'question:ask', { text: 'Hello world?' });
    expect(ack.ok).toBe(true);

    const audQ = await audReceived;
    expect(audQ.text).toBe('Hello world?');
    expect(audQ.authorName).toBe('Anonymous'); // default showAuthorNames = 'host'
    expect(audQ.authorUserId).toBeUndefined();
    expect(audQ.upvotes).toBeUndefined();

    const hostQ = await hostReceived;
    expect(hostQ.authorName).toBe('Audience'); // host sees the real name
    expect(hostQ.authorUserId).toBeTruthy();
  });

  it('toggles upvotes keyed by user and keeps the count correct', async () => {
    const { owner, code } = await setup();
    const hostSock = track(await connectClient(ctx.url, { token: owner.token }));
    await emit(hostSock, 'room:join', { code });
    const ask = await emit(hostSock, 'question:ask', { text: 'Concurrent upvotes?' });
    const questionId = ask.data.id;

    // 8 distinct users each upvote once.
    const users = await Promise.all(Array.from({ length: 8 }, () => registerUser(app)));
    const voterSocks = await Promise.all(
      users.map((u) => connectClient(ctx.url, { token: u.token }))
    );
    voterSocks.forEach(track);
    await Promise.all(voterSocks.map((s) => emit(s, 'room:join', { code })));
    await Promise.all(voterSocks.map((s) => emit(s, 'question:upvote', { questionId })));

    const state = await emit(hostSock, 'room:join', { code });
    const q = state.data.questions.find((x) => x.id === questionId);
    expect(q.upvoteCount).toBe(8);

    // One user toggles off → 7.
    await emit(voterSocks[0], 'question:upvote', { questionId });
    const state2 = await emit(hostSock, 'room:join', { code });
    expect(state2.data.questions.find((x) => x.id === questionId).upvoteCount).toBe(7);
  });

  it('rejects a duplicate poll vote with ALREADY_VOTED (one vote per user)', async () => {
    const { owner, audience, code } = await setup();
    const hostSock = track(await connectClient(ctx.url, { token: owner.token }));
    await emit(hostSock, 'room:join', { code });
    const created = await emit(hostSock, 'poll:create', { question: 'Pick', options: ['X', 'Y'] });
    const poll = created.data;
    const optX = poll.options[0].id;

    const audSock = track(await connectClient(ctx.url, { token: audience.token }));
    await emit(audSock, 'room:join', { code });

    const first = await emit(audSock, 'poll:vote', { pollId: poll.id, optionId: optX });
    expect(first.ok).toBe(true);
    expect(first.data.options.find((o) => o.id === optX).votes).toBe(1);

    const second = await emit(audSock, 'poll:vote', { pollId: poll.id, optionId: optX });
    expect(second.ok).toBe(false);
    expect(second.error.code).toBe('ALREADY_VOTED');
  });

  it('automatically closes a timed poll and rejects a late vote', async () => {
    const { owner, audience, code } = await setup();
    const hostSock = track(await connectClient(ctx.url, { token: owner.token }));
    const audSock = track(await connectClient(ctx.url, { token: audience.token }));
    await emit(hostSock, 'room:join', { code });
    await emit(audSock, 'room:join', { code });

    const pollUpdate = waitFor(audSock, 'poll:updated', 3000);
    const created = await emit(hostSock, 'poll:create', {
      question: 'Quick decision?',
      options: ['Yes', 'No'],
      durationSeconds: 1,
    });
    expect(created.ok).toBe(true);
    expect(created.data.closesAt).toBeTruthy();

    const expired = await pollUpdate;
    expect(expired.id).toBe(created.data.id);
    expect(expired.status).toBe('closed');

    const late = await emit(audSock, 'poll:vote', {
      pollId: created.data.id,
      optionId: created.data.options[0].id,
    });
    expect(late.ok).toBe(false);
    expect(late.error.code).toBe('POLL_CLOSED');
  });

  it('rejects host-only events from non-owners with FORBIDDEN', async () => {
    const { audience, code } = await setup();
    const audSock = track(await connectClient(ctx.url, { token: audience.token }));
    await emit(audSock, 'room:join', { code });

    const create = await emit(audSock, 'poll:create', { question: 'Q', options: ['A', 'B'] });
    expect(create.ok).toBe(false);
    expect(create.error.code).toBe('FORBIDDEN');

    const ask = await emit(audSock, 'question:ask', { text: 'A question' });
    const answer = await emit(audSock, 'question:answer', {
      questionId: ask.data.id,
      answered: true,
    });
    expect(answer.ok).toBe(false);
    expect(answer.error.code).toBe('FORBIDDEN');

    const close = await emit(audSock, 'room:close', {});
    expect(close.ok).toBe(false);
    expect(close.error.code).toBe('FORBIDDEN');
  });

  it('hides a question for the audience but keeps it for the host', async () => {
    const { owner, audience, code } = await setup();
    const hostSock = track(await connectClient(ctx.url, { token: owner.token }));
    const audSock = track(await connectClient(ctx.url, { token: audience.token }));
    await emit(hostSock, 'room:join', { code });
    await emit(audSock, 'room:join', { code });

    const ask = await emit(audSock, 'question:ask', { text: 'Hide me please' });
    const questionId = ask.data.id;

    const audUpdate = waitFor(audSock, 'question:updated');
    await emit(hostSock, 'question:hide', { questionId, hidden: true });
    expect((await audUpdate).hidden).toBe(true);

    const audState = await emit(audSock, 'room:join', { code });
    expect(audState.data.questions.find((q) => q.id === questionId)).toBeUndefined();
    const hostState = await emit(hostSock, 'room:join', { code });
    expect(hostState.data.questions.find((q) => q.id === questionId)).toBeDefined();
  });

  it('closing a room rejects writes and auto-closes open polls; reopening keeps history', async () => {
    const { owner, audience, code } = await setup();
    const hostSock = track(await connectClient(ctx.url, { token: owner.token }));
    const audSock = track(await connectClient(ctx.url, { token: audience.token }));
    await emit(hostSock, 'room:join', { code });
    await emit(audSock, 'room:join', { code });

    await emit(audSock, 'question:ask', { text: 'Before close' });
    const poll = (await emit(hostSock, 'poll:create', { question: 'P', options: ['A', 'B'] })).data;

    const roomUpdated = waitFor(audSock, 'room:updated');
    const close = await emit(hostSock, 'room:close', { sessionName: 'Week 1' });
    expect(close.ok).toBe(true);
    expect(close.data.status).toBe('closed');
    expect((await roomUpdated).status).toBe('closed');

    // Writes rejected after close.
    const late = await emit(audSock, 'question:ask', { text: 'Too late' });
    expect(late.ok).toBe(false);
    expect(late.error.code).toBe('ROOM_CLOSED');

    // Reopen → new session, old question still present.
    const open = await emit(hostSock, 'room:open', {});
    expect(open.ok).toBe(true);
    expect(open.data.status).toBe('open');
    expect(open.data.sessions.length).toBe(2);

    const state = await emit(hostSock, 'room:join', { code });
    expect(state.data.questions.some((q) => q.text === 'Before close')).toBe(true);
    // The pre-close poll was auto-closed.
    expect(state.data.polls.find((p) => p.id === poll.id).status).toBe('closed');
  });

  it('shows author names to the audience when showAuthorNames = all', async () => {
    const owner = await registerUser(app, { name: 'Owner' });
    const { code } = await createRoom(app, owner.token, { title: 'Named' });
    // flip the setting via REST PATCH
    const request = (await import('supertest')).default;
    await request(app)
      .patch(`/api/rooms/${code}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ settings: { showAuthorNames: 'all' } });

    const audience = await registerUser(app, { name: 'Namee' });
    const hostSock = track(await connectClient(ctx.url, { token: owner.token }));
    const audSock = track(await connectClient(ctx.url, { token: audience.token }));
    await emit(hostSock, 'room:join', { code });
    await emit(audSock, 'room:join', { code });

    const audReceived = waitFor(audSock, 'question:new');
    await emit(audSock, 'question:ask', { text: 'Named question' });
    expect((await audReceived).authorName).toBe('Namee');
  });

  it('enforces the per-IP connection cap on audience joins', async () => {
    const original = env.limits.maxSocketsPerIpPerRoom;
    env.limits.maxSocketsPerIpPerRoom = 2;
    try {
      const { code } = await setup();
      const a = await registerUser(app);
      const b = await registerUser(app);
      const c = await registerUser(app);
      const sa = track(await connectClient(ctx.url, { token: a.token }));
      const sb = track(await connectClient(ctx.url, { token: b.token }));
      const sc = track(await connectClient(ctx.url, { token: c.token }));
      expect((await emit(sa, 'room:join', { code })).ok).toBe(true);
      expect((await emit(sb, 'room:join', { code })).ok).toBe(true);
      const third = await emit(sc, 'room:join', { code });
      expect(third.ok).toBe(false);
      expect(third.error.code).toBe('RATE_LIMITED');
    } finally {
      env.limits.maxSocketsPerIpPerRoom = original;
    }
  });
});
