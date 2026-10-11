import crypto from 'node:crypto';
import { Poll } from '../models/Poll.js';
import { Vote } from '../models/Vote.js';
import { getRoomByCodeOrThrow, assertRoomOpen } from './roomService.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { requireObjectId } from '../utils/ids.js';

/** Create a poll (host-only; authorization enforced by the caller) in the current session. */
export async function createPoll({ roomCode, question, options }) {
  const room = await getRoomByCodeOrThrow(roomCode);
  assertRoomOpen(room);

  const poll = await Poll.create({
    roomId: room._id,
    roomCode: room.code,
    sessionId: room.currentSessionId,
    question,
    options: options.map((text) => ({ id: crypto.randomUUID(), text, votes: 0 })),
  });
  return poll;
}

export async function getPollOrThrow(roomId, pollId) {
  requireObjectId(pollId, 'Poll');
  const poll = await Poll.findOne({ _id: pollId, roomId });
  if (!poll) throw appError(ERROR_CODES.NOT_FOUND, 'Poll not found');
  return poll;
}

/**
 * Record a vote keyed by userId. The unique (pollId, userId) index makes duplicates
 * impossible (11000 → ALREADY_VOTED); the option count increments only after the Vote
 * row inserts.
 */
export async function recordVote({ roomCode, pollId, optionId, userId }) {
  requireObjectId(pollId, 'Poll');
  const room = await getRoomByCodeOrThrow(roomCode);
  assertRoomOpen(room);

  const poll = await Poll.findOne({ _id: pollId, roomId: room._id });
  if (!poll) throw appError(ERROR_CODES.NOT_FOUND, 'Poll not found');
  if (poll.status === 'closed') throw appError(ERROR_CODES.POLL_CLOSED, 'This poll is closed');

  const option = poll.options.find((o) => o.id === optionId);
  if (!option) throw appError(ERROR_CODES.VALIDATION_ERROR, 'Unknown poll option');

  try {
    await Vote.create({
      pollId: poll._id,
      roomId: room._id,
      sessionId: poll.sessionId,
      userId,
      optionId,
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw appError(ERROR_CODES.ALREADY_VOTED, 'You have already voted in this poll');
    }
    throw err;
  }

  const updated = await Poll.findOneAndUpdate(
    { _id: poll._id, 'options.id': optionId },
    { $inc: { 'options.$.votes': 1 } },
    { new: true }
  );
  return updated || poll;
}

export async function closePoll({ roomCode, pollId }) {
  const room = await getRoomByCodeOrThrow(roomCode);
  const poll = await getPollOrThrow(room._id, pollId);
  if (poll.status !== 'closed') {
    poll.status = 'closed';
    await poll.save();
  }
  return poll;
}
