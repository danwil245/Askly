import crypto from 'node:crypto';

// Unambiguous alphabet: no 0/O, 1/I/L, etc. (per spec section 5).
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;

/** Generate a single random join code using the unambiguous alphabet. */
export function generateCode(length = JOIN_CODE_LENGTH) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Generate a code that is unique according to `exists(code) => Promise<boolean>`,
 * retrying on collision up to `maxAttempts` times.
 * @param {(code: string) => Promise<boolean>} exists
 */
export async function generateUniqueCode(exists, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateCode();

    if (!(await exists(code))) return code;
  }
  throw new Error('generateUniqueCode: exhausted attempts finding a unique join code');
}
