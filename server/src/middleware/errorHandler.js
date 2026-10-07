import { AppError, ERROR_CODES } from '../utils/errors.js';
import { log } from '../utils/logger.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  log.error('rest.unhandled', { message: err?.message, stack: err?.stack });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: ERROR_CODES.NOT_FOUND, message: 'Not found' } });
}
