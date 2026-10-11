import { io } from 'socket.io-client';
import { getClientId } from '../lib/clientId.js';

// Single shared socket instance. Base URL from VITE_API_URL, else same-origin (dev proxy).
const URL = import.meta.env.VITE_API_URL || undefined;

let socket;
let currentToken = null;

export function getSocket() {
  if (!socket) {
    socket = io(URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: { clientId: getClientId(), token: currentToken || undefined },
    });
  }
  return socket;
}

/**
 * Update the auth token used on the handshake. If the token actually changed and the
 * socket is connected, reconnect so the server re-reads identity (after login/logout).
 */
export function setSocketAuth(token) {
  const next = token || null;
  if (next === currentToken) return;
  currentToken = next;
  if (socket) {
    socket.auth = { clientId: getClientId(), token: currentToken || undefined };
    if (socket.connected) {
      socket.disconnect().connect();
    }
  }
}

/**
 * Promise-based emit honoring the ack contract { ok, data?, error? }.
 * Rejects with an Error carrying `.code` on failure.
 */
export function emitAck(event, payload) {
  const s = getSocket();
  return new Promise((resolve, reject) => {
    s.timeout(8000).emit(event, payload, (timeoutErr, response) => {
      if (timeoutErr) {
        const e = new Error('Request timed out');
        e.code = 'TIMEOUT';
        reject(e);
        return;
      }
      if (response?.ok) {
        resolve(response.data);
      } else {
        const e = new Error(response?.error?.message || 'Request failed');
        e.code = response?.error?.code || 'UNKNOWN';
        reject(e);
      }
    });
  });
}
