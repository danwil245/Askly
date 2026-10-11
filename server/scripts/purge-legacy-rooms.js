/**
 * purge-legacy-rooms.js
 *
 * Deletes v1 "legacy" rooms — those without an `ownerId` — along with their
 * associated questions, polls and votes. Run this once against the production
 * database AFTER deploying v2 to remove unreachable v1 data.
 *
 * Usage:
 *   MONGODB_URI=mongodb+srv://... node server/scripts/purge-legacy-rooms.js
 *
 * A dry-run is performed first so you can see what will be deleted; you must
 * type "yes" to proceed.
 *
 * ⚠️  This is a destructive, irreversible operation. Take a database backup first.
 */

import 'dotenv/config';
import readline from 'node:readline/promises';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('FATAL: MONGODB_URI environment variable is required.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Minimal schemas — just enough to query and delete (no validation needed).
// ---------------------------------------------------------------------------

const RoomSchema = new mongoose.Schema({}, { strict: false, collection: 'rooms' });
const QuestionSchema = new mongoose.Schema({}, { strict: false, collection: 'questions' });
const PollSchema = new mongoose.Schema({}, { strict: false, collection: 'polls' });
const VoteSchema = new mongoose.Schema({}, { strict: false, collection: 'votes' });

const Room = mongoose.model('PurgeRoom', RoomSchema);
const Question = mongoose.model('PurgeQuestion', QuestionSchema);
const Poll = mongoose.model('PurgePoll', PollSchema);
const Vote = mongoose.model('PurgeVote', VoteSchema);

// ---------------------------------------------------------------------------

async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  // Legacy rooms = those where ownerId field is absent (v1 created rooms without accounts).
  const legacyRooms = await Room.find({ ownerId: { $exists: false } })
    .select('_id code')
    .lean();

  if (legacyRooms.length === 0) {
    console.log('✓ No legacy rooms found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  const roomIds = legacyRooms.map((r) => r._id);
  const roomCodes = legacyRooms.map((r) => r.code || '<no code>');

  const [questionCount, pollCount, voteCount] = await Promise.all([
    Question.countDocuments({ roomId: { $in: roomIds } }),
    Poll.countDocuments({ roomId: { $in: roomIds } }),
    Vote.countDocuments({ roomId: { $in: roomIds } }),
  ]);

  console.log('DRY RUN — the following will be PERMANENTLY DELETED:');
  console.log(`  Rooms     : ${legacyRooms.length}  (${roomCodes.join(', ')})`);
  console.log(`  Questions : ${questionCount}`);
  console.log(`  Polls     : ${pollCount}`);
  console.log(`  Votes     : ${voteCount}`);
  console.log('');
  console.log('⚠️  This cannot be undone. Ensure you have a database backup.');
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Type "yes" to proceed, anything else to abort: ');
  rl.close();

  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted. No changes were made.');
    await mongoose.disconnect();
    return;
  }

  console.log('\nDeleting…');

  const [voteDel, pollDel, questionDel, roomDel] = await Promise.all([
    Vote.deleteMany({ roomId: { $in: roomIds } }),
    Poll.deleteMany({ roomId: { $in: roomIds } }),
    Question.deleteMany({ roomId: { $in: roomIds } }),
    Room.deleteMany({ _id: { $in: roomIds } }),
  ]);

  console.log(`✓ Deleted ${roomDel.deletedCount} rooms`);
  console.log(`✓ Deleted ${questionDel.deletedCount} questions`);
  console.log(`✓ Deleted ${pollDel.deletedCount} polls`);
  console.log(`✓ Deleted ${voteDel.deletedCount} votes`);
  console.log('\nDone. Legacy v1 data has been purged.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error:', err?.message || err);
  process.exit(1);
});
