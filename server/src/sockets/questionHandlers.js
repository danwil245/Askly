import { withAck } from '../utils/ack.js';
import { questionAskSchema, questionUpvoteSchema } from './schemas.js';
import { createQuestion, toggleUpvote } from '../services/questionService.js';
import { requireJoined } from './guards.js';
import { enforceSocketLimit } from '../middleware/antiSpam.js';
import { emitQuestion, scheduleAnalytics } from './broadcast.js';
import { serializeQuestion } from '../utils/serialize.js';

const showNamesOf = (room) => room.settings?.showAuthorNames === 'all';

export function registerQuestionHandlers(io, socket) {
  socket.on(
    'question:ask',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      enforceSocketLimit('question', { id: socket.data.userId, ip: socket.data.ip });
      const { text } = questionAskSchema.parse(payload || {});

      const { question, room } = await createQuestion({
        roomCode: code,
        text,
        authorUserId: socket.data.userId,
        authorName: socket.data.user.name,
      });
      const showNames = showNamesOf(room);
      emitQuestion(io, code, 'question:new', question, showNames);
      scheduleAnalytics(io, code);

      return serializeQuestion(question, { isHost: socket.data.isHost, showNames });
    })
  );

  socket.on(
    'question:upvote',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      enforceSocketLimit('upvote', { id: socket.data.userId, ip: socket.data.ip });
      const { questionId } = questionUpvoteSchema.parse(payload || {});

      const { question, room } = await toggleUpvote({
        roomCode: code,
        questionId,
        userId: socket.data.userId,
      });
      const showNames = showNamesOf(room);
      emitQuestion(io, code, 'question:updated', question, showNames);
      scheduleAnalytics(io, code);

      const mine = (question.upvotes || []).includes(String(socket.data.userId));
      return {
        ...serializeQuestion(question, { isHost: socket.data.isHost, showNames }),
        upvotedByMe: mine,
      };
    })
  );
}
