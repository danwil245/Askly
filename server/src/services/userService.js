import { User } from '../models/User.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';

export async function getUserById(id) {
  requireObjectId(id, 'User');
  const user = await User.findById(id);
  if (!user) throw appError(ERROR_CODES.NOT_FOUND, 'User not found');
  return user;
}

export async function findByEmail(email) {
  return User.findOne({ email: String(email).toLowerCase().trim() });
}
