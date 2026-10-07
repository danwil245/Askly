// Host tokens are stored per room code in localStorage. This is the only thing (besides
// clientId) we persist. The server never returns the token again after creation.
const key = (code) => `askly.host.${String(code).toUpperCase()}`;

export function saveHostToken(code, token) {
  try {
    localStorage.setItem(key(code), token);
  } catch {
    /* ignore */
  }
}

export function getHostToken(code) {
  try {
    return localStorage.getItem(key(code));
  } catch {
    return null;
  }
}

export function clearHostToken(code) {
  try {
    localStorage.removeItem(key(code));
  } catch {
    /* ignore */
  }
}
