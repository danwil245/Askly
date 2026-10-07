// Canonical error codes shared across REST + sockets (spec section 8).
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_CLOSED: 'ROOM_CLOSED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  ALREADY_VOTED: 'ALREADY_VOTED',
  POLL_CLOSED: 'POLL_CLOSED',
  DUPLICATE_QUESTION: 'DUPLICATE_QUESTION',
  NOT_FOUND: 'NOT_FOUND',
};

const DEFAULT_STATUS = {
  VALIDATION_ERROR: 400,
  ROOM_NOT_FOUND: 404,
  ROOM_CLOSED: 409,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  ALREADY_VOTED: 409,
  POLL_CLOSED: 409,
  DUPLICATE_QUESTION: 409,
  NOT_FOUND: 404,
};

/**
 * An operational error with a stable `code` and optional HTTP `status`.
 * Thrown by services; caught by the Express error handler and the socket ack wrapper.
 */
export class AppError extends Error {
  constructor(code, message, { status, details } = {}) {
    super(message || code);
    this.name = 'AppError';
    this.code = code;
    this.status = status || DEFAULT_STATUS[code] || 500;
    this.details = details;
    this.isOperational = true;
  }
}

export const appError = (code, message, opts) => new AppError(code, message, opts);
