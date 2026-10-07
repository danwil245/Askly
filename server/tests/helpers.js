import http from 'node:http';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { attachSockets } from '../src/sockets/index.js';

/**
 * Boot an HTTP server with the Express app + Socket.io attached, listening on a random
 * free port. Returns the base URL and a close() to tear it down.
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
    // Close io first (disconnects live sockets) so the HTTP server can actually close.
    close: () =>
      new Promise((resolve) => {
        io.close(() => server.close(resolve));
      }),
  };
}

/** Connect a socket.io client with the given clientId; resolves once connected. */
export function connectClient(url, clientId) {
  const socket = ioClient(url, {
    transports: ['websocket'],
    auth: { clientId },
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
