// Canonical error codes shared across REST + sockets (v1 section 8 + v2 section 8).
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
  // v2
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  QUIZ_NOT_FOUND: 'QUIZ_NOT_FOUND',
  NICKNAME_TAKEN: 'NICKNAME_TAKEN',
  GAME_STARTED: 'GAME_STARTED',
  GAME_FULL: 'GAME_FULL',
  ALREADY_ANSWERED: 'ALREADY_ANSWERED',
  TIME_UP: 'TIME_UP',
  WRONG_PHASE: 'WRONG_PHASE',
  KICKED: 'KICKED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
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
  // v2
  UNAUTHENTICATED: 401,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  QUIZ_NOT_FOUND: 404,
  NICKNAME_TAKEN: 409,
  GAME_STARTED: 409,
  GAME_FULL: 409,
  ALREADY_ANSWERED: 409,
  TIME_UP: 409,
  WRONG_PHASE: 409,
  KICKED: 403,
  SERVICE_UNAVAILABLE: 503,
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
