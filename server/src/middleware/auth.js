import { verifyToken } from '../utils/jwt.js';
import { getUserById } from '../services/userService.js';
import { AppError, ERROR_CODES } from '../utils/errors.js';

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

/**
 * Require a valid JWT. On success attaches `req.user = { id, name, email }` (the public
 * shape) and `req.userId`. Rejects with 401 UNAUTHENTICATED otherwise.
 */
export async function requireAuth(req, _res, next) {
  try {
    const userId = verifyToken(bearer(req));
    if (!userId) throw new AppError(ERROR_CODES.UNAUTHENTICATED, 'Sign in to continue');
    const user = await getUserById(userId);
    req.user = user.toPublic();
    req.userId = req.user.id;
    next();
  } catch (err) {
    if (err instanceof AppError && err.code === ERROR_CODES.NOT_FOUND) {
      next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Sign in to continue'));
      return;
    }
    next(err);
  }
}

/** Attach the user if a valid token is present; otherwise continue anonymously. */
export async function optionalAuth(req, _res, next) {
  try {
    const userId = verifyToken(bearer(req));
    if (userId) {
      const user = await getUserById(userId).catch(() => null);
      if (user) {
        req.user = user.toPublic();
        req.userId = req.user.id;
      }
    }
  } catch {
    /* ignore — anonymous */
  }
  next();
}
