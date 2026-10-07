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

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

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
    throw new ApiError(err.code || 'HTTP_ERROR', err.message || res.statusText, res.status);
  }
  return data;
}

export const api = {
  createRoom: (title) => request('/api/rooms', { method: 'POST', body: { title } }),
  getRoom: (code) => request(`/api/rooms/${encodeURIComponent(code)}`),
  getAnalytics: (code, token) =>
    request(`/api/rooms/${encodeURIComponent(code)}/analytics`, { token }),
};
