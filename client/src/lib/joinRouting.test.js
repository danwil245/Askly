import { describe, it, expect } from 'vitest';
import { resolveJoinTarget } from './joinRouting.js';

describe('resolveJoinTarget (landing join routing)', () => {
  it('sends quiz codes straight to the player — no login', () => {
    expect(resolveJoinTarget({ code: 'abc123', type: 'quiz' }, { isAuthenticated: false })).toBe(
      '/play/ABC123'
    );
  });

  it('sends a logged-in user straight into a qa/mentor room', () => {
    expect(resolveJoinTarget({ code: 'ROOM01', type: 'qa' }, { isAuthenticated: true })).toBe(
      '/r/ROOM01'
    );
    expect(resolveJoinTarget({ code: 'ROOM02', type: 'mentor' }, { isAuthenticated: true })).toBe(
      '/r/ROOM02'
    );
  });

  it('redirects an anonymous user to login with a next back into the room', () => {
    expect(resolveJoinTarget({ code: 'ROOM03', type: 'qa' }, { isAuthenticated: false })).toBe(
      '/login?next=%2Fr%2FROOM03'
    );
  });
});
