import { AppError, ERROR_CODES } from '../utils/errors.js';

/**
 * Shared ownership assertion used by every owner-only REST route and socket event.
 * Throws FORBIDDEN unless the authenticated user owns the resource.
 * @param {{ ownerId: any }} doc  a document with an ownerId
 * @param {string} userId
 */
export function assertOwned(doc, userId) {
  if (!doc || !userId || String(doc.ownerId) !== String(userId)) {
    throw new AppError(ERROR_CODES.FORBIDDEN, 'You do not own this resource');
  }
}
