// Anonymous, persistent client identity. Not a security boundary — only a dedupe key
// for upvotes/votes (spec section 6). One UUID per browser, stored in localStorage.
const KEY = 'askly.clientId';

export function getClientId() {
  let id = null;
  try {
    id = localStorage.getItem(KEY);
  } catch {
    /* localStorage unavailable (private mode) — fall back to an ephemeral id */
  }
  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  }
  return id;
}
