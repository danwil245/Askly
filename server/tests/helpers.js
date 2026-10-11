import http from 'node:http';
import crypto from 'node:crypto';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { attachSockets } from '../src/sockets/index.js';

/**
 * Boot an HTTP server with the Express app + Socket.io attached on a random free port.
 */
export async function startTestServer() {
  const app = createApp();
  const server = http.createServer(app);
  const io = attachSockets(server);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    server,
    io,
    close: () => new Promise((resolve) => io.close(() => server.close(resolve))),
  };
}

/** Register a fresh user via REST; returns { token, user }. */
export async function registerUser(app, overrides = {}) {
  const email = overrides.email || `u_${crypto.randomUUID()}@example.com`;
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name: overrides.name || 'Test User', email, password: overrides.password || 'password123' });
  return res.body;
}

/** Create a qa/mentor room owned by `token`; returns { code, room, currentSession }. */
export async function createRoom(app, token, { type = 'qa', title = 'Test Room', chapterId } = {}) {
  const res = await request(app)
    .post('/api/rooms')
    .set('Authorization', `Bearer ${token}`)
    .send({ type, title, chapterId });
  return { ...res.body, code: res.body?.room?.code, status: res.status };
}

/** Connect a socket.io client with an optional JWT + clientId; resolves once connected. */
export function connectClient(url, { token, clientId } = {}) {
  const socket = ioClient(url, {
    transports: ['websocket'],
    auth: { token, clientId },
    forceNew: true,
  });
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

/** Promise wrapper around an emit with ack. */
export function emit(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res) => resolve(res));
  });
}

/** Resolve with the next payload for `event`, or reject after `timeout` ms. */
export function waitFor(socket, event, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeout);
    const handler = (payload) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}
