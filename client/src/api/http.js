// Thin fetch wrapper for the REST API. Base URL comes from VITE_API_URL; when empty
// we rely on the Vite dev proxy (same-origin /api).
const BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

// Module-level auth token + 401 handler, wired up by AuthContext.
let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token || null;
}
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, { method = 'GET', body, token, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const bearer = token || (auth ? authToken : null);
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server', 0);
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const err = data?.error || {};
    const code = err.code || 'HTTP_ERROR';
    // A 401 on an authed request means the token is stale — clear + redirect to login.
    if (res.status === 401 && bearer && onUnauthorized) onUnauthorized();
    throw new ApiError(code, err.message || res.statusText, res.status);
  }
  return data;
}

const enc = encodeURIComponent;
const qs = (params) => {
  const entries = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null);
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};

export const api = {
  // health / feature detection
  health: () => request('/health', { auth: false }),

  // auth
  signup: (payload) => request('/api/auth/signup', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload, auth: false }),
  google: (idToken) =>
    request('/api/auth/google', { method: 'POST', body: { idToken }, auth: false }),
  me: () => request('/api/auth/me'),

  // rooms
  getRoom: (code) => request(`/api/rooms/${enc(code)}`, { auth: false }),
  createRoom: (payload) => request('/api/rooms', { method: 'POST', body: payload }),
  myRooms: (params) => request(`/api/rooms/mine${qs(params)}`),
  patchRoom: (code, payload) => request(`/api/rooms/${enc(code)}`, { method: 'PATCH', body: payload }),
  openRoom: (code) => request(`/api/rooms/${enc(code)}/open`, { method: 'POST' }),
  closeRoom: (code, sessionName) =>
    request(`/api/rooms/${enc(code)}/close`, { method: 'POST', body: { sessionName } }),
  roomSessions: (code) => request(`/api/rooms/${enc(code)}/sessions`),
  getAnalytics: (code, sessionId) =>
    request(`/api/rooms/${enc(code)}/analytics${qs({ sessionId })}`),

  // sessions
  getSession: (id) => request(`/api/sessions/${enc(id)}`),
  renameSession: (id, name) => request(`/api/sessions/${enc(id)}`, { method: 'PATCH', body: { name } }),

  // chapters
  chapters: (params) => request(`/api/chapters${qs(params)}`),
  createChapter: (payload) => request('/api/chapters', { method: 'POST', body: payload }),
  patchChapter: (id, payload) => request(`/api/chapters/${enc(id)}`, { method: 'PATCH', body: payload }),

  // quizzes
  quizzes: () => request('/api/quizzes'),
  createQuiz: (payload) => request('/api/quizzes', { method: 'POST', body: payload }),
  getQuiz: (id) => request(`/api/quizzes/${enc(id)}`),
  updateQuiz: (id, payload) => request(`/api/quizzes/${enc(id)}`, { method: 'PUT', body: payload }),
  deleteQuiz: (id) => request(`/api/quizzes/${enc(id)}`, { method: 'DELETE' }),
  hostQuiz: (id, payload) => request(`/api/quizzes/${enc(id)}/host`, { method: 'POST', body: payload }),
  quizGames: () => request('/api/quizzes/games'),
};
