import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { startTestServer, connectClient, emit, waitFor } from './helpers.js';
import { createApp } from '../src/app.js';
import { resetBuckets } from '../src/middleware/antiSpam.js';
import { env } from '../src/config/env.js';

// All test clients connect from 127.0.0.1, so lift the per-IP connection cap for the
// suite (it's exercised directly in antiSpam-focused assertions where relevant).
env.limits.maxSocketsPerIpPerRoom = 1000;

const app = createApp();

/** Create a room over REST and return { code, hostToken }. */
async function makeRoom(title = 'Socket Room') {
  const res = await request(app).post('/api/rooms').send({ title });
  return res.body;
}

describe('socket contract', () => {
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

  it('sets isHost only with a valid host token', async () => {
    const { code, hostToken } = await makeRoom();

    const host = track(await connectClient(ctx.url, 'host-1'));
    const hostJoin = await emit(host, 'room:join', { code, clientId: 'host-1', hostToken });
    expect(hostJoin.ok).toBe(true);
    expect(hostJoin.data.isHost).toBe(true);

    const aud = track(await connectClient(ctx.url, 'aud-1'));
    const audJoin = await emit(aud, 'room:join', { code, clientId: 'aud-1' });
    expect(audJoin.ok).toBe(true);
    expect(audJoin.data.isHost).toBe(false);

    const badHost = track(await connectClient(ctx.url, 'aud-2'));
    const bad = await emit(badHost, 'room:join', { code, clientId: 'aud-2', hostToken: 'nope' });
    expect(bad.ok).toBe(true);
    expect(bad.data.isHost).toBe(false);
  });

  it('returns ROOM_NOT_FOUND when joining an unknown room', async () => {
    const s = track(await connectClient(ctx.url, 'x'));
    const res = await emit(s, 'room:join', { code: 'ZZZZZZ', clientId: 'x' });
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('broadcasts question:new to all clients in the room', async () => {
    const { code } = await makeRoom();
    const a = track(await connectClient(ctx.url, 'a'));
    const b = track(await connectClient(ctx.url, 'b'));
    await emit(a, 'room:join', { code, clientId: 'a' });
    await emit(b, 'room:join', { code, clientId: 'b' });

    const received = waitFor(b, 'question:new');
    const ack = await emit(a, 'question:ask', { text: 'Hello world?' });
    expect(ack.ok).toBe(true);

    const q = await received;
    expect(q.text).toBe('Hello world?');
    expect(q.upvoteCount).toBe(0);
    // Audience payload must not leak author identity or the upvotes array.
    expect(q.authorId).toBeUndefined();
    expect(q.upvotes).toBeUndefined();
  });

  it('toggles upvotes and keeps the count correct under many distinct clients', async () => {
    const { code } = await makeRoom();
    const asker = track(await connectClient(ctx.url, 'asker'));
    await emit(asker, 'room:join', { code, clientId: 'asker' });
    const ask = await emit(asker, 'question:ask', { text: 'Concurrent upvotes?' });
    const questionId = ask.data.id;

    // 20 distinct clients each upvote once, concurrently.
    const voters = await Promise.all(
      Array.from({ length: 20 }, (_, i) => connectClient(ctx.url, `v${i}`))
    );
    voters.forEach(track);
    await Promise.all(voters.map((s, i) => emit(s, 'room:join', { code, clientId: `v${i}` })));
    await Promise.all(voters.map((s) => emit(s, 'question:upvote', { questionId })));

    // Re-fetch authoritative state (server is source of truth for the count).
    const state = await emit(asker, 'room:join', { code, clientId: 'asker' });
    const q = state.data.questions.find((x) => x.id === questionId);
    expect(q.upvoteCount).toBe(20);

    // One voter toggles off → count drops to 19.
    await emit(voters[0], 'question:upvote', { questionId });
    const state2 = await emit(asker, 'room:join', { code, clientId: 'asker' });
    const q2 = state2.data.questions.find((x) => x.id === questionId);
    expect(q2.upvoteCount).toBe(19);
  });

  it('rejects a duplicate poll vote with ALREADY_VOTED and does not change counts', async () => {
    const { code, hostToken } = await makeRoom();
    const host = track(await connectClient(ctx.url, 'host'));
    await emit(host, 'room:join', { code, clientId: 'host', hostToken });

    const created = await emit(host, 'poll:create', {
      question: 'Pick',
      options: ['X', 'Y'],
    });
    const poll = created.data;
    const optX = poll.options[0].id;

    const voter = track(await connectClient(ctx.url, 'voter'));
    await emit(voter, 'room:join', { code, clientId: 'voter' });

    const first = await emit(voter, 'poll:vote', { pollId: poll.id, optionId: optX });
    expect(first.ok).toBe(true);
    expect(first.data.options.find((o) => o.id === optX).votes).toBe(1);

    const second = await emit(voter, 'poll:vote', { pollId: poll.id, optionId: optX });
    expect(second.ok).toBe(false);
    expect(second.error.code).toBe('ALREADY_VOTED');

    // Count unchanged.
    const state = await emit(host, 'room:join', { code, clientId: 'host', hostToken });
    const p = state.data.polls.find((x) => x.id === poll.id);
    expect(p.options.find((o) => o.id === optX).votes).toBe(1);
  });

  it('rejects host-only events from a non-host with FORBIDDEN', async () => {
    const { code } = await makeRoom();
    const aud = track(await connectClient(ctx.url, 'aud'));
    await emit(aud, 'room:join', { code, clientId: 'aud' });

    const create = await emit(aud, 'poll:create', { question: 'Q', options: ['A', 'B'] });
    expect(create.ok).toBe(false);
    expect(create.error.code).toBe('FORBIDDEN');

    const ask = await emit(aud, 'question:ask', { text: 'A question to hide' });
    const answer = await emit(aud, 'question:answer', {
      questionId: ask.data.id,
      answered: true,
    });
    expect(answer.ok).toBe(false);
    expect(answer.error.code).toBe('FORBIDDEN');

    const close = await emit(aud, 'room:close', {});
    expect(close.ok).toBe(false);
    expect(close.error.code).toBe('FORBIDDEN');
  });

  it('hides a question for the audience but keeps it for the host', async () => {
    const { code, hostToken } = await makeRoom();
    const host = track(await connectClient(ctx.url, 'host'));
    const aud = track(await connectClient(ctx.url, 'aud'));
    await emit(host, 'room:join', { code, clientId: 'host', hostToken });
    await emit(aud, 'room:join', { code, clientId: 'aud' });

    const ask = await emit(aud, 'question:ask', { text: 'Hide me please' });
    const questionId = ask.data.id;

    const audUpdate = waitFor(aud, 'question:updated');
    await emit(host, 'question:hide', { questionId, hidden: true });
    const updated = await audUpdate;
    expect(updated.hidden).toBe(true);

    // Audience state excludes the hidden question; host state includes it.
    const audState = await emit(aud, 'room:join', { code, clientId: 'aud' });
    expect(audState.data.questions.find((q) => q.id === questionId)).toBeUndefined();

    const hostState = await emit(host, 'room:join', { code, clientId: 'host', hostToken });
    expect(hostState.data.questions.find((q) => q.id === questionId)).toBeDefined();
  });

  it('rejects writes after the room is closed and a vote after the poll closes', async () => {
    const { code, hostToken } = await makeRoom();
    const host = track(await connectClient(ctx.url, 'host'));
    await emit(host, 'room:join', { code, clientId: 'host', hostToken });

    const created = await emit(host, 'poll:create', { question: 'P', options: ['A', 'B'] });
    const poll = created.data;

    // Close the poll → voting rejected.
    await emit(host, 'poll:close', { pollId: poll.id });
    const voter = track(await connectClient(ctx.url, 'voter'));
    await emit(voter, 'room:join', { code, clientId: 'voter' });
    const pollClosed = await emit(voter, 'poll:vote', {
      pollId: poll.id,
      optionId: poll.options[0].id,
    });
    expect(pollClosed.ok).toBe(false);
    expect(pollClosed.error.code).toBe('POLL_CLOSED');

    // Close the room → further writes rejected.
    await emit(host, 'room:close', {});
    const afterClose = await emit(voter, 'question:ask', { text: 'Too late?' });
    expect(afterClose.ok).toBe(false);
    expect(afterClose.error.code).toBe('ROOM_CLOSED');
  });

  it('rate limits a burst of questions with RATE_LIMITED', async () => {
    const { code } = await makeRoom();
    const s = track(await connectClient(ctx.url, 'burst'));
    await emit(s, 'room:join', { code, clientId: 'burst' });

    // Default limit is 5 questions/min; the 6th distinct question should trip it.
    const results = [];
    for (let i = 0; i < 8; i += 1) {
      results.push(await emit(s, 'question:ask', { text: `Burst question number ${i}` }));
    }
    const limited = results.filter((r) => !r.ok && r.error.code === 'RATE_LIMITED');
    expect(limited.length).toBeGreaterThan(0);
  });

  it('updates presence as audience clients connect', async () => {
    const { code, hostToken } = await makeRoom();
    const host = track(await connectClient(ctx.url, 'host'));
    const hostJoin = await emit(host, 'room:join', { code, clientId: 'host', hostToken });
    // Host does not count toward audience presence.
    expect(hostJoin.data).toBeDefined();

    const aud = track(await connectClient(ctx.url, 'aud'));
    const presence = waitFor(aud, 'presence:updated');
    await emit(aud, 'room:join', { code, clientId: 'aud' });
    const p = await presence;
    expect(p.count).toBeGreaterThanOrEqual(1);
  });

  it('enforces the per-IP connection cap on audience joins', async () => {
    const original = env.limits.maxSocketsPerIpPerRoom;
    env.limits.maxSocketsPerIpPerRoom = 2;
    try {
      const { code } = await makeRoom();
      const a = track(await connectClient(ctx.url, 'cap-a'));
      const b = track(await connectClient(ctx.url, 'cap-b'));
      const c = track(await connectClient(ctx.url, 'cap-c'));

      expect((await emit(a, 'room:join', { code, clientId: 'cap-a' })).ok).toBe(true);
      expect((await emit(b, 'room:join', { code, clientId: 'cap-b' })).ok).toBe(true);
      // Third socket from the same IP into the same room is rejected.
      const third = await emit(c, 'room:join', { code, clientId: 'cap-c' });
      expect(third.ok).toBe(false);
      expect(third.error.code).toBe('RATE_LIMITED');
    } finally {
      env.limits.maxSocketsPerIpPerRoom = original;
    }
  });
});
