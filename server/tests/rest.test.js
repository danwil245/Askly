import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();

async function tokenFor() {
  const { token } = await registerUser(app);
  return token;
}

describe('REST /api/rooms (v2)', () => {
  let token;
  beforeEach(async () => {
    token = await tokenFor();
  });

  it('health check responds ok and reports googleEnabled', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('googleEnabled');
  });

  it('requires auth to create a room', async () => {
    const res = await request(app).post('/api/rooms').send({ type: 'qa', title: 'X' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('creates a qa room open with a first session', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'qa', title: 'My Session' });
    expect(res.status).toBe(201);
    expect(res.body.room.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.body.room).toMatchObject({ title: 'My Session', type: 'qa', status: 'open' });
    expect(res.body.currentSession.id).toBeTruthy();
    expect(res.body.currentSession.status).toBe('active');
  });

  it('exposes public meta that routes by type and hides internals', async () => {
    const created = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'qa', title: 'Public Meta' });
    const { code } = created.body.room;

    const meta = await request(app).get(`/api/rooms/${code}`);
    expect(meta.status).toBe(200);
    expect(meta.body).toEqual({ code, title: 'Public Meta', type: 'qa', status: 'open' });
    expect(meta.body.ownerId).toBeUndefined();
  });

  it('rejects an invalid type and an empty title', async () => {
    const badType = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'quiz', title: 'X' }); // quiz rooms are created via /quizzes/:id/host
    expect(badType.status).toBe(400);

    const badTitle = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'qa', title: '' });
    expect(badTitle.status).toBe(400);
  });

  it('returns ROOM_NOT_FOUND for an unknown code', async () => {
    const res = await request(app).get('/api/rooms/ZZZZZZ');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('lists only the caller’s own rooms', async () => {
    await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'qa', title: 'Mine 1' });

    const otherToken = await tokenFor();
    await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ type: 'qa', title: 'Theirs' });

    const mine = await request(app).get('/api/rooms/mine').set('Authorization', `Bearer ${token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.rooms).toHaveLength(1);
    expect(mine.body.rooms[0].title).toBe('Mine 1');
    expect(mine.body.rooms[0].currentSession).toBeTruthy();
  });

  it('guards analytics and owner actions behind ownership', async () => {
    const created = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'qa', title: 'Guarded' });
    const { code } = created.body.room;

    const otherToken = await tokenFor();
    const forbidden = await request(app)
      .get(`/api/rooms/${code}/analytics`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(app)
      .get(`/api/rooms/${code}/analytics`)
      .set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.totals.questions).toBe(0);
  });
});
