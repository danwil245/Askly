import crypto from 'node:crypto';
import { Poll } from '../models/Poll.js';
import { Vote } from '../models/Vote.js';
import { getRoomOrThrow, assertRoomOpen } from './roomService.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';

/** Create a poll with server-generated option ids. */
export async function createPoll({ roomCode, question, options }) {
  const room = await getRoomOrThrow(roomCode);
  assertRoomOpen(room);

  const poll = await Poll.create({
    roomCode,
    question,
    options: options.map((text) => ({ id: crypto.randomUUID(), text, votes: 0 })),
  });
  return poll;
}

export async function getPollOrThrow(roomCode, pollId) {
  requireObjectId(pollId, 'Poll');
  const poll = await Poll.findOne({ _id: pollId, roomCode });
  if (!poll) throw appError(ERROR_CODES.NOT_FOUND, 'Poll not found');
  return poll;
}

/**
 * Record a vote. Layered guarantees:
 *  1. room + poll must be open,
 *  2. unique (pollId, clientId) index makes duplicates impossible — a Mongo 11000
 *     duplicate-key error maps to ALREADY_VOTED,
 *  3. the option count is incremented atomically only after the Vote row inserts.
 */
export async function recordVote({ roomCode, pollId, optionId, clientId }) {
  requireObjectId(pollId, 'Poll');
  const room = await getRoomOrThrow(roomCode);
  assertRoomOpen(room);

  const poll = await Poll.findOne({ _id: pollId, roomCode });
  if (!poll) throw appError(ERROR_CODES.NOT_FOUND, 'Poll not found');
  if (poll.status === 'closed') throw appError(ERROR_CODES.POLL_CLOSED, 'This poll is closed');

  const option = poll.options.find((o) => o.id === optionId);
  if (!option) throw appError(ERROR_CODES.VALIDATION_ERROR, 'Unknown poll option');

  try {
    await Vote.create({ pollId: poll._id, roomCode, clientId, optionId });
  } catch (err) {
    if (err?.code === 11000) {
      throw appError(ERROR_CODES.ALREADY_VOTED, 'You have already voted in this poll');
    }
    throw err;
  }

  // Atomic increment of the chosen option's count.
  const updated = await Poll.findOneAndUpdate(
    { _id: poll._id, 'options.id': optionId },
    { $inc: { 'options.$.votes': 1 } },
    { new: true }
  );
  return updated || poll;
}

export async function closePoll({ roomCode, pollId }) {
  const poll = await getPollOrThrow(roomCode, pollId);
  if (poll.status !== 'closed') {
    poll.status = 'closed';
    await poll.save();
  }
  return poll;
}
