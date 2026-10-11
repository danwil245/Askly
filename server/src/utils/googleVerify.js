import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';

let client;
function getClient() {
  if (!client) client = new OAuth2Client(env.googleClientId);
  return client;
}

/**
 * Verify a Google ID token against GOOGLE_CLIENT_ID. Returns a normalized profile
 * `{ googleId, email, emailVerified, name, avatarUrl }` or throws.
 *
 * Isolated behind this module so tests can mock it without touching the network.
 */
export async function verifyGoogleIdToken(idToken) {
  const ticket = await getClient().verifyIdToken({
    idToken,
    audience: env.googleClientId,
  });
  const payload = ticket.getPayload();
  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name || payload.email,
    avatarUrl: payload.picture || undefined,
  };
}
