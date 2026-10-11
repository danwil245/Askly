/**
 * One-off migration: delete v1 (pre-accounts) data. v1 rooms have no ownerId and v1
 * questions/polls/votes have no sessionId, so they are unreachable in v2. No data
 * migration is needed (spec section 5).
 *
 * Usage:  MONGODB_URI=... node server/src/scripts/purge-legacy-rooms.js
 */
import mongoose from 'mongoose';
import { env, assertRequiredEnv } from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { Room } from '../models/Room.js';
import { Question } from '../models/Question.js';
import { Poll } from '../models/Poll.js';
import { Vote } from '../models/Vote.js';
import { log } from '../utils/logger.js';

async function main() {
  assertRequiredEnv();
  await connectDb(env.mongodbUri);

  const results = {
    rooms: (await Room.deleteMany({ ownerId: { $exists: false } })).deletedCount,
    questions: (await Question.deleteMany({ sessionId: { $exists: false } })).deletedCount,
    polls: (await Poll.deleteMany({ sessionId: { $exists: false } })).deletedCount,
    votes: (await Vote.deleteMany({ sessionId: { $exists: false } })).deletedCount,
  };

  console.log('[purge-legacy-rooms] deleted:', JSON.stringify(results));
  await disconnectDb();
}

main().catch((err) => {
  log.error('purge.failed', { message: err?.message });
  return mongoose.disconnect().finally(() => process.exit(1));
});
