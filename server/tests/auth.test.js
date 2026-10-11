import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock the Google verifier so no network/credentials are needed.
vi.mock('../src/utils/googleVerify.js', () => ({
  verifyGoogleIdToken: vi.fn(),
}));

import { verifyGoogleIdToken } from '../src/utils/googleVerify.js';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';

const app = createApp();

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.googleClientId = 'test-google-client-id'; // enable the Google path
  });

  describe('signup', () => {
    it('creates an account and returns a token + public user', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Ada', email: 'Ada@Example.com', password: 'supersecret' });
      expect(res.status).toBe(201);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user).toMatchObject({ name: 'Ada', email: 'ada@example.com' });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.googleId).toBeUndefined();
    });

    it('rejects a weak password and a bad email', async () => {
      const weak = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'A', email: 'a@b.com', password: 'short' });
      expect(weak.status).toBe(400);
      expect(weak.body.error.code).toBe('VALIDATION_ERROR');

      const bad = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'A', email: 'not-an-email', password: 'longenough' });
      expect(bad.status).toBe(400);
    });

    it('rejects a duplicate email with EMAIL_TAKEN', async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({ name: 'A', email: 'dup@example.com', password: 'longenough' });
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'B', email: 'dup@example.com', password: 'longenough' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Grace', email: 'grace@example.com', password: 'hopper123' });
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'grace@example.com', password: 'hopper123' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    });

    it('returns a generic INVALID_CREDENTIALS for wrong password and unknown email', async () => {
      const wrong = await request(app)
        .post('/api/auth/login')
        .send({ email: 'grace@example.com', password: 'wrongpass' });
      expect(wrong.status).toBe(401);
      expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

      const unknown = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever1' });
      expect(unknown.status).toBe(401);
      expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
      // Same message for both — no account enumeration.
      expect(unknown.body.error.message).toBe(wrong.body.error.message);
    });
  });

  describe('me', () => {
    it('returns the current user with a valid token and 401 without', async () => {
      const signup = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Linus', email: 'linus@example.com', password: 'kernel123' });
      const { token } = signup.body;

      const ok = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(ok.status).toBe(200);
      expect(ok.body.user.email).toBe('linus@example.com');

      const no = await request(app).get('/api/auth/me');
      expect(no.status).toBe(401);
      expect(no.body.error.code).toBe('UNAUTHENTICATED');

      const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage');
      expect(bad.status).toBe(401);
    });
  });

  describe('google', () => {
    it('creates a new account from a verified Google token', async () => {
      verifyGoogleIdToken.mockResolvedValue({
        googleId: 'g-123',
        email: 'guser@example.com',
        emailVerified: true,
        name: 'G User',
        avatarUrl: 'http://img/avatar.png',
      });
      const res = await request(app).post('/api/auth/google').send({ idToken: 'tok' });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('guser@example.com');

      const user = await User.findOne({ email: 'guser@example.com' });
      expect(user.googleId).toBe('g-123');
    });

    it('links Google to an existing password account and removes the passwordHash', async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Squat', email: 'target@example.com', password: 'password1' });

      verifyGoogleIdToken.mockResolvedValue({
        googleId: 'g-link',
        email: 'target@example.com',
        emailVerified: true,
        name: 'Target',
      });
      const res = await request(app).post('/api/auth/google').send({ idToken: 'tok' });
      expect(res.status).toBe(200);

      const user = await User.findOne({ email: 'target@example.com' });
      expect(user.googleId).toBe('g-link');
      expect(user.passwordHash).toBeFalsy(); // password access revoked

      // The old password no longer works.
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'target@example.com', password: 'password1' });
      expect(login.status).toBe(401);
    });

    it('rejects an unverified Google email', async () => {
      verifyGoogleIdToken.mockResolvedValue({
        googleId: 'g-x',
        email: 'unverified@example.com',
        emailVerified: false,
        name: 'X',
      });
      const res = await request(app).post('/api/auth/google').send({ idToken: 'tok' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 503 when Google is not configured', async () => {
      env.googleClientId = '';
      const res = await request(app).post('/api/auth/google').send({ idToken: 'tok' });
      expect(res.status).toBe(503);
    });
  });
});
