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

  limits: {
    questionsPerMin: num(process.env.RL_QUESTIONS_PER_MIN, 5),
    upvotesPerMin: num(process.env.RL_UPVOTES_PER_MIN, 30),
    votesPerMin: num(process.env.RL_VOTES_PER_MIN, 20),
    roomCreatePerHour: num(process.env.RL_ROOM_CREATE_PER_HOUR, 10),
    duplicateQuestionWindowMs: num(process.env.DUPLICATE_QUESTION_WINDOW_MS, 30_000),
    maxSocketsPerIpPerRoom: num(process.env.MAX_SOCKETS_PER_IP_PER_ROOM, 5),
    analyticsThrottleMs: num(process.env.ANALYTICS_THROTTLE_MS, 2000),
  },
};

/**
 * Fail fast on missing required config. Skipped in test mode where the Mongo URI
 * is injected by mongodb-memory-server before the app connects.
 */
export function assertRequiredEnv() {
  if (!env.isTest && !env.mongodbUri) {
    console.error('[config] FATAL: MONGODB_URI is required but was not provided.');
    process.exit(1);
  }
}
