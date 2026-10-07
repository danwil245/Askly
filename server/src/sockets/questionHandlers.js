import { withAck } from '../utils/ack.js';
import { questionAskSchema, questionUpvoteSchema } from './schemas.js';
import { createQuestion, toggleUpvote } from '../services/questionService.js';
import { requireJoined } from './guards.js';
import { enforceSocketLimit } from '../middleware/antiSpam.js';
import { emitQuestion, scheduleAnalytics } from './broadcast.js';
import { serializeQuestion } from '../utils/serialize.js';

export function registerQuestionHandlers(io, socket) {
  socket.on(
    'question:ask',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      enforceSocketLimit('question', { clientId: socket.data.clientId, ip: socket.data.ip });
      const { text } = questionAskSchema.parse(payload || {});

      const q = await createQuestion({ roomCode: code, text, authorId: socket.data.clientId });
      emitQuestion(io, code, 'question:new', q);
      scheduleAnalytics(io, code);

      // Ack the author with their own (host-shaped so they see their authorId) view.
      return serializeQuestion(q, socket.data.isHost);
    })
  );

  socket.on(
    'question:upvote',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      enforceSocketLimit('upvote', { clientId: socket.data.clientId, ip: socket.data.ip });
      const { questionId } = questionUpvoteSchema.parse(payload || {});

      const q = await toggleUpvote({ roomCode: code, questionId, clientId: socket.data.clientId });
      emitQuestion(io, code, 'question:updated', q);
      scheduleAnalytics(io, code);

      const mine = (q.upvotes || []).includes(socket.data.clientId);
      return { ...serializeQuestion(q, socket.data.isHost), upvotedByMe: mine };
    })
  );
}
