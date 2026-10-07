import { ZodError } from 'zod';
import { AppError, ERROR_CODES } from './errors.js';
import { log } from './logger.js';

/** Shape helpers for the socket ack contract: { ok: true, data? } | { ok: false, error }. */
export const ackOk = (data) => ({ ok: true, ...(data !== undefined ? { data } : {}) });
export const ackErr = (code, message) => ({ ok: false, error: { code, message } });

/**
 * Wrap an async socket handler so that:
 *  - the last argument is always treated as the ack callback (made a no-op if absent),
 *  - thrown errors are converted to a well-formed ack instead of crashing the process,
 *  - zod validation errors map to VALIDATION_ERROR.
 *
 * Usage: socket.on('event', withAck(async (payload, { socket, io }) => data))
 */
export function withAck(handler, ctx) {
  return async (...args) => {
    const maybeAck = args[args.length - 1];
    const ack = typeof maybeAck === 'function' ? maybeAck : () => {};
    const payload = typeof maybeAck === 'function' ? args[0] : args[0];
    try {
      const data = await handler(payload, ctx);
      ack(ackOk(data));
    } catch (err) {
      if (err instanceof ZodError) {
        ack(ackErr(ERROR_CODES.VALIDATION_ERROR, firstZodMessage(err)));
        return;
      }
      if (err instanceof AppError) {
        ack(ackErr(err.code, err.message));
        return;
      }
      log.error('socket.handler.unhandled', { message: err?.message, stack: err?.stack });
      ack(ackErr('INTERNAL_ERROR', 'Something went wrong'));
    }
  };
}

export function firstZodMessage(err) {
  const issue = err.issues?.[0];
  if (!issue) return 'Invalid input';
  const path = issue.path?.length ? `${issue.path.join('.')}: ` : '';
  return `${path}${issue.message}`;
}
