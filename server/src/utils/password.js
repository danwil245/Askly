import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/** Hash a plaintext password with bcrypt (cost from BCRYPT_ROUNDS). */
export function hashPassword(plain) {
  return bcrypt.hash(plain, env.bcryptRounds);
}

/** Constant-time compare of a plaintext password against a stored hash. */
export function verifyPassword(plain, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}
