import { describe, it, expect } from 'vitest';
import {
  generateCode,
  generateUniqueCode,
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
} from '../src/utils/joinCode.js';
import { generateHostToken, sha256, verifyToken } from '../src/utils/hash.js';
import { TokenBucket } from '../src/middleware/tokenBucket.js';

describe('joinCode', () => {
  it('generates codes of the right length using only the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateCode();
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      for (const ch of code) expect(JOIN_CODE_ALPHABET).toContain(ch);
    }
  });

  it('never includes ambiguous characters', () => {
    const banned = ['0', 'O', '1', 'I', 'L'];
    for (let i = 0; i < 200; i += 1) {
      const code = generateCode();
      for (const b of banned) expect(code).not.toContain(b);
    }
  });

  it('retries on collision and eventually returns a unique code', async () => {
    const taken = new Set(['AAAAAA']);
    let calls = 0;
    const exists = async (c) => {
      calls += 1;
      // Pretend the first produced code collides once.
      if (calls === 1) return true;
      return taken.has(c);
    };
    const code = await generateUniqueCode(exists);
    expect(code).toHaveLength(6);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('throws if it cannot find a unique code', async () => {
    await expect(generateUniqueCode(async () => true, 3)).rejects.toThrow(/exhausted/);
  });
});

describe('hash / host tokens', () => {
  it('hashes deterministically and verifies the raw token', () => {
    const token = generateHostToken();
    const hash = sha256(token);
    expect(hash).toHaveLength(64);
    expect(sha256(token)).toBe(hash);
    expect(verifyToken(token, hash)).toBe(true);
  });

  it('rejects a wrong or missing token', () => {
    const hash = sha256(generateHostToken());
    expect(verifyToken('wrong', hash)).toBe(false);
    expect(verifyToken('', hash)).toBe(false);
    expect(verifyToken(generateHostToken(), '')).toBe(false);
  });
});

// Person 3 — Anti-Spamming Security: Unit tests for the TokenBucket algorithm (capacity, refill rate, sweeping).
describe('TokenBucket', () => {
  it('allows up to capacity then blocks', () => {
    const b = new TokenBucket({ capacity: 3, windowMs: 60_000 });
    expect(b.take('k')).toBe(true);
    expect(b.take('k')).toBe(true);
    expect(b.take('k')).toBe(true);
    expect(b.take('k')).toBe(false); // 4th blocked
  });

  it('tracks keys independently', () => {
    const b = new TokenBucket({ capacity: 1, windowMs: 60_000 });
    expect(b.take('a')).toBe(true);
    expect(b.take('a')).toBe(false);
    expect(b.take('b')).toBe(true);
  });

  it('refills over time', async () => {
    const b = new TokenBucket({ capacity: 2, windowMs: 100 });
    expect(b.take('k')).toBe(true);
    expect(b.take('k')).toBe(true);
    expect(b.take('k')).toBe(false);
    await new Promise((r) => setTimeout(r, 120));
    expect(b.take('k')).toBe(true); // refilled
  });
});
