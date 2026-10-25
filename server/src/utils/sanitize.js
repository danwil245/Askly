/**
 * Anti-Spamming Security: String Sanitization Utilities
 * Utility functions for input sanitization, control-character stripping, and whitespace trimming.
 */
// Shared text hygiene: strip control characters (keep tab/newline/CR) and trim.
// Done by codepoint so no literal control bytes live in source.
const KEEP = new Set([9, 10, 13]);

export function stripControlChars(s) {
  if (typeof s !== 'string') return '';
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    const isC0 = cp <= 0x1f;
    const isC1 = cp >= 0x7f && cp <= 0x9f;
    if (KEEP.has(cp) || (!isC0 && !isC1)) out += ch;
  }
  return out;
}

/** Trim + strip control chars. For single-line fields, collapse inner newlines too. */
export function cleanText(s, { singleLine = false } = {}) {
  let v = stripControlChars(s).trim();
  if (singleLine) v = v.replace(/\s+/g, ' ');
  return v;
}
