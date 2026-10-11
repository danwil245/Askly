import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('room lifecycle + sessions (REST)', () => {
  let token;
  let code;

  beforeEach(async () => {
    ({ token } = await registerUser(app));
    const created = await request(app)
      .post('/api/rooms')
      .set(auth(token))
      .send({ type: 'qa', title: 'Lifecycle' });
    code = created.body.room.code;
  });

  it('closes with a session name, writes a summary, and reopens with a new session', async () => {
    const close = await request(app)
      .post(`/api/rooms/${code}/close`)
      .set(auth(token))
      .send({ sessionName: 'Kickoff' });
    expect(close.status).toBe(200);
    expect(close.body.room.status).toBe('closed');

    const sessions1 = await request(app).get(`/api/rooms/${code}/sessions`).set(auth(token));
    expect(sessions1.body.sessions).toHaveLength(1);
    expect(sessions1.body.sessions[0].name).toBe('Kickoff');
    expect(sessions1.body.sessions[0].status).toBe('ended');
    expect(sessions1.body.sessions[0].summary).toBeTruthy();

    const open = await request(app).post(`/api/rooms/${code}/open`).set(auth(token));
    expect(open.status).toBe(200);
    expect(open.body.room.status).toBe('open');

    const sessions2 = await request(app).get(`/api/rooms/${code}/sessions`).set(auth(token));
    expect(sessions2.body.sessions).toHaveLength(2);
  });

  it('keeps the default session name when closing without one', async () => {
    await request(app).post(`/api/rooms/${code}/close`).set(auth(token)).send({});
    const sessions = await request(app).get(`/api/rooms/${code}/sessions`).set(auth(token));
    expect(sessions.body.sessions[0].name).toMatch(/^Session,/);
  });

  it('renames a session and reads back the report', async () => {
    const close = await request(app).post(`/api/rooms/${code}/close`).set(auth(token)).send({});
    const list = await request(app).get(`/api/rooms/${code}/sessions`).set(auth(token));
    const sessionId = list.body.sessions[0].id;
    void close;

    const renamed = await request(app)
      .patch(`/api/sessions/${sessionId}`)
      .set(auth(token))
      .send({ name: 'Renamed Session' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.session.name).toBe('Renamed Session');

    const report = await request(app).get(`/api/sessions/${sessionId}`).set(auth(token));
    expect(report.status).toBe(200);
    expect(report.body.session.name).toBe('Renamed Session');
    expect(Array.isArray(report.body.questions)).toBe(true);
  });

  it('forbids a non-owner from closing, opening, or reading sessions', async () => {
    const other = await registerUser(app);
    for (const call of [
      request(app).post(`/api/rooms/${code}/close`).set(auth(other.token)).send({}),
      request(app).post(`/api/rooms/${code}/open`).set(auth(other.token)),
      request(app).get(`/api/rooms/${code}/sessions`).set(auth(other.token)),
    ]) {
      const res = await call;
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });
});
