import mongoose from 'mongoose';
import { appError, ERROR_CODES } from './errors.js';

/** Return the id if it's a valid ObjectId, else throw NOT_FOUND (avoids CastErrors). */
export function requireObjectId(id, label = 'Resource') {
  if (!mongoose.isValidObjectId(id)) {
    throw appError(ERROR_CODES.NOT_FOUND, `${label} not found`);
  }
  return id;
}
