/**
 * chapters.test.js — integration tests for the Mentor Rooms chapter subsystem.
 *
 * Test suite: "chapters (mentor mode)"
 *
 * Setup: a fresh authenticated user is registered before each test via `registerUser()`.
 * All HTTP requests use Supertest against the in-memory Express app; no real HTTP port
 * is opened. The MongoDB in-memory server (configured in tests/setup.js) provides
 * isolation between test runs.
 *
 * Coverage:
 *   1. Create and list    — POST /api/chapters creates a chapter (201); GET /api/chapters
 *                           returns it with roomCount = 0 before any rooms are added.
 *
 *   2. Unique names       — Case-insensitive uniqueness per owner: posting "algorithms"
 *                           when "Algorithms" already exists returns 400 VALIDATION_ERROR.
 *                           A different owner may reuse the same name (cross-owner isolation).
 *
 *   3. Mentor room chapter requirement — Creating a mentor room without a chapterId returns
 *                           400; creating one with a valid owned chapterId returns 201 and
 *                           increments the chapter's roomCount to 1.
 *
 *   4. Chapter ownership  — A user cannot create a mentor room inside a chapter owned by
 *                           another user; the API returns 403 or 404.
 *
 *   5. Archive and filter — PATCH /api/chapters/:id { archived: true } sets the flag (200).
 *                           Archived chapters are excluded from the default GET list;
 *                           they appear when `?includeArchived=true` is passed.
 *
 *   6. Move between chapters — A mentor room can be moved from chapter A to chapter B via
 *                           PATCH /api/rooms/:code { chapterId: b.id }. The room then
 *                           appears in GET /api/rooms/mine?type=mentor&chapterId=<B>.
 *
 *   7. Ownership on patch — A user cannot rename or modify a chapter owned by another
 *                           user; the API returns 403.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('chapters (mentor mode)', () => {
  let token;
  beforeEach(async () => {
    ({ token } = await registerUser(app));
  });

  const makeChapter = (name, t = token) =>
    request(app).post('/api/chapters').set(auth(t)).send({ name });

  // Test 1: Basic create + list with roomCount.
  it('creates and lists chapters with room counts', async () => {
    const c = await makeChapter('SSN');
    expect(c.status).toBe(201);
    expect(c.body.chapter.name).toBe('SSN');

    const list = await request(app).get('/api/chapters').set(auth(token));
    expect(list.status).toBe(200);
    expect(list.body.chapters).toHaveLength(1);
    expect(list.body.chapters[0].roomCount).toBe(0);
  });

  // Test 2: Case-insensitive unique names per owner; cross-owner name reuse is allowed.
  it('enforces case-insensitive unique chapter names per owner', async () => {
    await makeChapter('Algorithms');
    const dup = await makeChapter('algorithms');
    expect(dup.status).toBe(400);
    expect(dup.body.error.code).toBe('VALIDATION_ERROR');

    // A different owner can reuse the name.
    const other = await registerUser(app);
    const ok = await makeChapter('Algorithms', other.token);
    expect(ok.status).toBe(201);
  });

  // Test 3: Mentor rooms require a valid owned chapter; room creation increments roomCount.
  it('requires a valid owned chapter to create a mentor room, and counts it', async () => {
    const chapter = (await makeChapter('Data Structures')).body.chapter;

    const noChapter = await request(app)
      .post('/api/rooms')
      .set(auth(token))
      .send({ type: 'mentor', title: 'Orphan' });
    expect(noChapter.status).toBe(400);

    const room = await request(app)
      .post('/api/rooms')
      .set(auth(token))
      .send({ type: 'mentor', title: 'Lists', chapterId: chapter.id });
    expect(room.status).toBe(201);

    const list = await request(app).get('/api/chapters').set(auth(token));
    expect(list.body.chapters[0].roomCount).toBe(1);
  });

  // Test 4: Chapter ownership enforced — cross-user mentor room creation is rejected.
  it('cannot create a mentor room in a chapter owned by someone else', async () => {
    const chapter = (await makeChapter('Mine')).body.chapter;
    const other = await registerUser(app);
    const res = await request(app)
      .post('/api/rooms')
      .set(auth(other.token))
      .send({ type: 'mentor', title: 'Sneaky', chapterId: chapter.id });
    expect([403, 404]).toContain(res.status);
  });

  // Test 5: Archive flag; archived chapters are hidden from the default list.
  it('archives a chapter and hides it from the default list', async () => {
    const chapter = (await makeChapter('Temp')).body.chapter;
    const patched = await request(app)
      .patch(`/api/chapters/${chapter.id}`)
      .set(auth(token))
      .send({ archived: true });
    expect(patched.status).toBe(200);
    expect(patched.body.chapter.archived).toBe(true);

    const def = await request(app).get('/api/chapters').set(auth(token));
    expect(def.body.chapters).toHaveLength(0);
    const withArchived = await request(app)
      .get('/api/chapters?includeArchived=true')
      .set(auth(token));
    expect(withArchived.body.chapters).toHaveLength(1);
  });

  // Test 6: Move-between-chapters via PATCH /rooms/:code { chapterId }.
  it('moves a mentor room between chapters via PATCH /rooms/:code', async () => {
    const a = (await makeChapter('Chapter A')).body.chapter;
    const b = (await makeChapter('Chapter B')).body.chapter;
    const room = (
      await request(app)
        .post('/api/rooms')
        .set(auth(token))
        .send({ type: 'mentor', title: 'Movable', chapterId: a.id })
    ).body.room;

    const moved = await request(app)
      .patch(`/api/rooms/${room.code}`)
      .set(auth(token))
      .send({ chapterId: b.id });
    expect(moved.status).toBe(200);

    const inB = await request(app)
      .get(`/api/rooms/mine?type=mentor&chapterId=${b.id}`)
      .set(auth(token));
    expect(inB.body.rooms.map((r) => r.code)).toContain(room.code);
  });

  // Test 7: Ownership on PATCH /chapters/:id — cross-user rename is forbidden.
  it('forbids patching a chapter you do not own', async () => {
    const chapter = (await makeChapter('Owned')).body.chapter;
    const other = await registerUser(app);
    const res = await request(app)
      .patch(`/api/chapters/${chapter.id}`)
      .set(auth(other.token))
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(403);
  });
});
