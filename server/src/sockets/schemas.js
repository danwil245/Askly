/**
 * Person 3 — Anti-Spamming Security: Zod Payload Schemas
 * Payload schemas enforcing length constraints, whitespace trimming, and control-character stripping.
 */
import { z } from 'zod';

// Strip control characters but keep normal whitespace (tab/newline/CR), per anti-spam
// hygiene (spec section 10.4). Done by codepoint so no literal control bytes live in source.
const KEEP = new Set([9, 10, 13]); // \t \n \r
const stripControlChars = (s) =>
  Array.from(s)
    .filter((ch) => {
      const cp = ch.codePointAt(0);
      const isC0 = cp <= 0x1f;
      const isC1 = cp >= 0x7f && cp <= 0x9f;
      return KEEP.has(cp) || (!isC0 && !isC1);
    })
    .join('');
const cleanText = (s) => stripControlChars(s).trim();

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, 'Join code must be 6 characters');

// v2: room:join carries only { code }. Identity comes from the handshake token; the
// server decides isHost from ownership. There is no hostToken anymore.
export const roomJoinSchema = z.object({ code });

export const questionAskSchema = z.object({
  text: z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(1, 'Question cannot be empty').max(280)),
});

export const questionUpvoteSchema = z.object({
  questionId: z.string().trim().min(1),
});

export const questionAnswerSchema = z.object({
  questionId: z.string().trim().min(1),
  answered: z.boolean(),
});

// spec section 9: hide handler accepts both true and false (unhide).
export const questionHideSchema = z.object({
  questionId: z.string().trim().min(1),
  hidden: z.boolean().optional().default(true),
});

export const pollCreateSchema = z.object({
  question: z.string().transform(cleanText).pipe(z.string().min(1).max(140)),
  options: z
    .array(z.string().transform(cleanText).pipe(z.string().min(1).max(80)))
    .min(2, 'A poll needs at least 2 options')
    .max(6, 'A poll can have at most 6 options'),
});

export const pollVoteSchema = z.object({
  pollId: z.string().trim().min(1),
  optionId: z.string().trim().min(1),
});

export const pollCloseSchema = z.object({
  pollId: z.string().trim().min(1),
});

export const roomCloseSchema = z
  .object({ sessionName: z.string().transform(cleanText).pipe(z.string().max(100)).optional() })
  .optional();

export const roomOpenSchema = z.object({}).optional();
