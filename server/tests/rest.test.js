import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('REST /api/rooms', () => {
  it('health check responds ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('creates a room and returns the host token exactly once', async () => {
    const res = await request(app).post('/api/rooms').send({ title: 'My Session' });
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.body.title).toBe('My Session');
    expect(typeof res.body.hostToken).toBe('string');
    expect(res.body.hostTokenHash).toBeUndefined();

    // GET meta never leaks the token or its hash.
    const meta = await request(app).get(`/api/rooms/${res.body.code}`);
    expect(meta.status).toBe(200);
    expect(meta.body).toEqual({ code: res.body.code, title: 'My Session', status: 'open' });
    expect(meta.body.hostToken).toBeUndefined();
    expect(meta.body.hostTokenHash).toBeUndefined();
  });

  it('rejects an empty title with VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/rooms').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns ROOM_NOT_FOUND for an unknown code', async () => {
    const res = await request(app).get('/api/rooms/ZZZZZZ');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('guards analytics behind the host token', async () => {
    const created = await request(app).post('/api/rooms').send({ title: 'Guarded' });
    const { code, hostToken } = created.body;

    const noAuth = await request(app).get(`/api/rooms/${code}/analytics`);
    expect(noAuth.status).toBe(403);
    expect(noAuth.body.error.code).toBe('FORBIDDEN');

    const withAuth = await request(app)
      .get(`/api/rooms/${code}/analytics`)
      .set('Authorization', `Bearer ${hostToken}`);
    expect(withAuth.status).toBe(200);
    expect(withAuth.body.totals.questions).toBe(0);
  });
});
