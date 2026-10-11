import { User } from '../models/User.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { verifyGoogleIdToken } from '../utils/googleVerify.js';
import { cleanText } from '../utils/sanitize.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { googleEnabled } from '../config/env.js';

const authResult = (user) => ({ token: signToken(user._id), user: user.toPublic() });

/** Email + password signup. */
export async function signup({ name, email, password }) {
  const cleanName = cleanText(name, { singleLine: true });
  const normEmail = String(email).toLowerCase().trim();

  const existing = await User.findOne({ email: normEmail });
  if (existing) throw appError(ERROR_CODES.EMAIL_TAKEN, 'That email is already registered');

  const user = await User.create({
    name: cleanName,
    email: normEmail,
    passwordHash: await hashPassword(password),
  });
  return authResult(user);
}

/**
 * Email + password login. Always returns the same generic error on any failure so we
 * never reveal whether an email exists. Runs a dummy hash compare when the user is
 * missing to keep timing roughly constant.
 */
export async function login({ email, password }) {
  const normEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normEmail });

  const ok = await verifyPassword(
    password,
    user?.passwordHash || '$2a$10$0000000000000000000000000000000000000000000000000000'
  );
  if (!user || !user.passwordHash || !ok) {
    throw appError(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
  }
  return authResult(user);
}

/**
 * Google sign-in. Verifies the ID token, then finds the user by googleId, else by
 * email (linking the Google account — and, per spec section 6, dropping any existing
 * passwordHash so an email squatter cannot retain access), else creates a new user.
 */
export async function googleSignIn({ idToken }) {
  if (!googleEnabled()) {
    throw appError(ERROR_CODES.SERVICE_UNAVAILABLE, 'Google sign-in is not configured');
  }

  let profile;
  try {
    profile = await verifyGoogleIdToken(idToken);
  } catch {
    throw appError(ERROR_CODES.INVALID_CREDENTIALS, 'Could not verify Google sign-in');
  }
  if (!profile.emailVerified) {
    throw appError(ERROR_CODES.INVALID_CREDENTIALS, 'Google account email is not verified');
  }

  // 1) Existing Google-linked user.
  let user = await User.findOne({ googleId: profile.googleId });
  if (user) return authResult(user);

  // 2) Existing email account → link Google and REMOVE the password (security rule).
  user = await User.findOne({ email: profile.email.toLowerCase() });
  if (user) {
    user.googleId = profile.googleId;
    user.passwordHash = undefined;
    if (!user.avatarUrl && profile.avatarUrl) user.avatarUrl = profile.avatarUrl;
    await user.save();
    return authResult(user);
  }

  // 3) Brand-new account.
  user = await User.create({
    name: cleanText(profile.name, { singleLine: true }) || profile.email,
    email: profile.email.toLowerCase(),
    googleId: profile.googleId,
    avatarUrl: profile.avatarUrl,
  });
  return authResult(user);
}
