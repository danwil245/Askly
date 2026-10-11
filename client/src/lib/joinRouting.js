/**
 * Decide where a join code should route, based on the room's type and auth state
 * (spec section 10). Pure so it can be unit-tested without a DOM.
 *
 * @param {{ code: string, type: 'quiz'|'qa'|'mentor' }} meta
 * @param {{ isAuthenticated: boolean }} ctx
 * @returns {string} the path to navigate to
 */
export function resolveJoinTarget(meta, { isAuthenticated } = {}) {
  const code = String(meta.code).toUpperCase();
  if (meta.type === 'quiz') return `/play/${code}`;
  // qa / mentor require login first.
  if (isAuthenticated) return `/r/${code}`;
  return `/login?next=${encodeURIComponent(`/r/${code}`)}`;
}
