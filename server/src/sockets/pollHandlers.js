import { withAck } from '../utils/ack.js';
import { pollCreateSchema, pollVoteSchema, pollCloseSchema } from './schemas.js';
import { createPoll, recordVote, closePoll } from '../services/pollService.js';
import { requireJoined, requireHost } from './guards.js';
import { enforceSocketLimit } from '../middleware/antiSpam.js';
import { emitPoll, scheduleAnalytics } from './broadcast.js';
import { serializePoll } from '../utils/serialize.js';

export function registerPollHandlers(io, socket) {
  // Host-only: create a poll.
  socket.on(
    'poll:create',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      requireHost(socket);
      const { question, options } = pollCreateSchema.parse(payload || {});

      const poll = await createPoll({ roomCode: code, question, options });
      emitPoll(io, code, 'poll:new', poll);
      scheduleAnalytics(io, code);
      return serializePoll(poll);
    })
  );

  // Audience/host: vote (keyed by userId).
  socket.on(
    'poll:vote',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      enforceSocketLimit('vote', { id: socket.data.userId, ip: socket.data.ip });
      const { pollId, optionId } = pollVoteSchema.parse(payload || {});

      const poll = await recordVote({
        roomCode: code,
        pollId,
        optionId,
        userId: socket.data.userId,
      });
      emitPoll(io, code, 'poll:updated', poll);
      scheduleAnalytics(io, code);
      return { ...serializePoll(poll), myOptionId: optionId };
    })
  );

  // Host-only: close a poll.
  socket.on(
    'poll:close',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      requireHost(socket);
      const { pollId } = pollCloseSchema.parse(payload || {});

      const poll = await closePoll({ roomCode: code, pollId });
      emitPoll(io, code, 'poll:updated', poll);
      scheduleAnalytics(io, code);
      return serializePoll(poll);
    })
  );
}
