import { withAck } from '../utils/ack.js';
import {
  questionAnswerSchema,
  questionHideSchema,
  questionSpotlightSchema,
  roomCloseSchema,
  roomOpenSchema,
} from './schemas.js';
import { setAnswered, setHidden, setSpotlight } from '../services/moderationService.js';
import { getRoomByCodeOrThrow, assertOwner } from '../services/roomService.js';
import * as lifecycle from '../services/roomLifecycleService.js';
import { requireJoined, requireHost } from './guards.js';
import { emitQuestion, emitRoomUpdated, emitSpotlight, scheduleAnalytics } from './broadcast.js';
import { serializeQuestion } from '../utils/serialize.js';

const showNamesOf = (room) => room.settings?.showAuthorNames === 'all';

/** Host-only moderation + room lifecycle handlers (ownership enforced via requireHost). */
export function registerModerationHandlers(io, socket) {
  socket.on(
    'question:answer',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      requireHost(socket);
      const { questionId, answered } = questionAnswerSchema.parse(payload || {});

      const { question, room } = await setAnswered({ roomCode: code, questionId, answered });
      emitQuestion(io, code, 'question:updated', question, showNamesOf(room));
      scheduleAnalytics(io, code);
      return serializeQuestion(question, { isHost: true, showNames: showNamesOf(room) });
    })
  );

  socket.on(
    'question:hide',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      requireHost(socket);
      const { questionId, hidden } = questionHideSchema.parse(payload || {});

      const { question, room, spotlightCleared } = await setHidden({
        roomCode: code,
        questionId,
        hidden,
      });
      emitQuestion(io, code, 'question:updated', question, showNamesOf(room));
      if (spotlightCleared) emitSpotlight(io, code, null);
      scheduleAnalytics(io, code);
      return serializeQuestion(question, { isHost: true, showNames: showNamesOf(room) });
    })
  );

  socket.on(
    'question:spotlight',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      requireHost(socket);
      const { questionId } = questionSpotlightSchema.parse(payload || {});

      const result = await setSpotlight({ roomCode: code, questionId });
      if (result.previous) {
        emitQuestion(io, code, 'question:updated', result.previous, showNamesOf(result.room));
        scheduleAnalytics(io, code);
      }
      emitSpotlight(io, code, result.questionId);
      return { questionId: result.questionId };
    })
  );

  socket.on(
    'room:close',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      requireHost(socket);
      const { sessionName } = roomCloseSchema.parse(payload ?? {}) || {};

      const room = await getRoomByCodeOrThrow(code);
      assertOwner(room, socket.data.userId);
      await lifecycle.close(room, { sessionName });

      const updated = await lifecycle.roomUpdatedPayload(room);
      emitRoomUpdated(io, code, updated);
      scheduleAnalytics(io, code);
      return updated;
    })
  );

  socket.on(
    'room:open',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      requireHost(socket);
      roomOpenSchema.parse(payload ?? {});

      const room = await getRoomByCodeOrThrow(code);
      assertOwner(room, socket.data.userId);
      await lifecycle.open(room);

      const updated = await lifecycle.roomUpdatedPayload(room);
      emitRoomUpdated(io, code, updated);
      scheduleAnalytics(io, code);
      return updated;
    })
  );
}
