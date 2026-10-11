import { z } from 'zod';
import { withAck } from '../utils/ack.js';
import * as engine from '../services/quizEngine.js';
import { enforceSocketLimit } from '../middleware/antiSpam.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import * as qb from './quizBroadcast.js';

const codeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, 'Invalid code'),
});
const joinSchema = codeSchema.extend({
  nickname: z.string().trim().min(2).max(20),
  clientId: z.string().trim().min(1).max(100),
});
const answerSchema = z.object({
  questionId: z.string().trim().min(1),
  optionId: z.string().trim().min(1),
});
const kickSchema = z.object({ playerId: z.string().trim().min(1) });

export function registerQuizHandlers(io, socket) {
  // Host joins the game controller (auth + ownership).
  socket.on(
    'quiz:host:join',
    withAck(async (payload) => {
      const { code } = codeSchema.parse(payload || {});
      if (!socket.data.user) throw appError(ERROR_CODES.UNAUTHENTICATED, 'Sign in to host');
      const game = await engine.getOrCreateGame(code);
      if (String(game.ownerId) !== String(socket.data.user.id)) {
        throw appError(ERROR_CODES.FORBIDDEN, 'Only the host can control this game');
      }
      socket.data.quizCode = code;
      socket.data.isQuizHost = true;
      socket.join(code);
      socket.join(qb.hostRoom(code));
      return engine.hostSnapshot(game);
    })
  );

  // Player joins with a nickname (no account).
  socket.on(
    'quiz:join',
    withAck(async (payload) => {
      const { code, nickname, clientId } = joinSchema.parse(payload || {});
      enforceSocketLimit('quizAnswer', { id: clientId, ip: socket.data.ip });
      const game = await engine.getOrCreateGame(code);
      socket.data.quizCode = code;
      socket.data.quizClientId = clientId;
      return engine.playerJoin(game, { nickname, clientId }, socket);
    })
  );

  socket.on(
    'quiz:answer',
    withAck(async (payload) => {
      const code = socket.data.quizCode;
      const clientId = socket.data.quizClientId;
      if (!code || !clientId) throw appError(ERROR_CODES.WRONG_PHASE, 'Join the game first');
      enforceSocketLimit('quizAnswer', { id: clientId, ip: socket.data.ip });
      const { questionId, optionId } = answerSchema.parse(payload || {});
      const game = await engine.getOrCreateGame(code);
      return engine.submitAnswer(game, clientId, { questionId, optionId });
    })
  );

  // --- host controls ---
  const hostAction = (fn) =>
    withAck(async (payload) => {
      const code = socket.data.quizCode;
      if (!code || !socket.data.isQuizHost) throw appError(ERROR_CODES.FORBIDDEN, 'Host only');
      if (!socket.data.user) throw appError(ERROR_CODES.UNAUTHENTICATED, 'Sign in');
      const game = await engine.getOrCreateGame(code);
      return fn(game, socket.data.user.id, payload);
    });

  socket.on('quiz:start', hostAction((game, uid) => engine.start(game, uid)));
  socket.on('quiz:skip', hostAction((game, uid) => engine.skip(game, uid)));
  socket.on('quiz:next', hostAction((game, uid) => engine.next(game, uid)));
  socket.on('quiz:end', hostAction((game, uid) => engine.end(game, uid)));
  socket.on(
    'quiz:kick',
    hostAction((game, uid, payload) => {
      const { playerId } = kickSchema.parse(payload || {});
      return engine.kick(game, uid, playerId);
    })
  );

  socket.on('disconnect', () => {
    const code = socket.data.quizCode;
    const clientId = socket.data.quizClientId;
    if (code && clientId) {
      const game = engine.peekGame(code);
      if (game) engine.markDisconnected(game, clientId);
    }
  });
}
