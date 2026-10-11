import dotenv from 'dotenv';

dotenv.config();

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isTest = process.env.NODE_ENV === 'test';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest,
  port: num(process.env.PORT, 4000),
  // In tests the URI is supplied programmatically by mongodb-memory-server.
  mongodbUri: process.env.MONGODB_URI || '',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  // --- Auth (v2) ---
  // In tests a value is injected by tests/setup.js so signing works.
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),

  // --- Quiz (v2) ---
  quiz: {
    pointsPerCorrect: num(process.env.QUIZ_POINTS_PER_CORRECT, 100),
    maxPlayers: num(process.env.QUIZ_MAX_PLAYERS, 200),
  },

  limits: {
    questionsPerMin: num(process.env.RL_QUESTIONS_PER_MIN, 5),
    upvotesPerMin: num(process.env.RL_UPVOTES_PER_MIN, 30),
    votesPerMin: num(process.env.RL_VOTES_PER_MIN, 20),
    // v2: room creation is now limited per USER (default raised to 30).
    roomCreatePerHour: num(process.env.RL_ROOM_CREATE_PER_HOUR, 30),
    duplicateQuestionWindowMs: num(process.env.DUPLICATE_QUESTION_WINDOW_MS, 30_000),
    // v2: campus Wi-Fi reality — raised; now only a flood guard.
    maxSocketsPerIpPerRoom: num(process.env.MAX_SOCKETS_PER_IP_PER_ROOM, 300),
    analyticsThrottleMs: num(process.env.ANALYTICS_THROTTLE_MS, 2000),
    // v2 auth limiters.
    authPer15Min: num(process.env.RL_AUTH_PER_15MIN, 60),
    loginFailsPer15Min: num(process.env.RL_LOGIN_FAILS_PER_15MIN, 10),
    quizAnswersPerMin: num(process.env.RL_QUIZ_ANSWERS_PER_MIN, 120),
  },
};

/** Whether Google sign-in is configured server-side. */
export const googleEnabled = () => !!env.googleClientId;

/**
 * Fail fast on missing/invalid required config. Skipped in test mode where the Mongo
 * URI is injected by mongodb-memory-server and JWT_SECRET is set by the test setup.
 */
export function assertRequiredEnv() {
  if (env.isTest) return;
  if (!env.mongodbUri) {
    console.error('[config] FATAL: MONGODB_URI is required but was not provided.');
    process.exit(1);
  }
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    console.error('[config] FATAL: JWT_SECRET is required and must be at least 32 characters.');
    process.exit(1);
  }
}
