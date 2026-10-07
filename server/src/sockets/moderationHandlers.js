import { withAck } from '../utils/ack.js';
import { questionAnswerSchema, questionHideSchema, roomCloseSchema } from './schemas.js';
import { setAnswered, setHidden } from '../services/moderationService.js';
import { closeRoom } from '../services/roomService.js';
import { requireJoined, requireHost } from './guards.js';
import { emitQuestion, emitRoomUpdated, scheduleAnalytics } from './broadcast.js';
import { serializeQuestion } from '../utils/serialize.js';

/**
 * Area C — host-only moderation handlers. Every handler calls requireHost; a non-host
 * socket emitting these events gets FORBIDDEN via the ack.
 */
export function registerModerationHandlers(io, socket) {
  socket.on(
    'question:answer',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      requireHost(socket);
      const { questionId, answered } = questionAnswerSchema.parse(payload || {});

      const q = await setAnswered({ roomCode: code, questionId, answered });
      emitQuestion(io, code, 'question:updated', q);
      scheduleAnalytics(io, code);
      return serializeQuestion(q, true);
    })
  );

  socket.on(
    'question:hide',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      requireHost(socket);
      const { questionId, hidden } = questionHideSchema.parse(payload || {});

      const q = await setHidden({ roomCode: code, questionId, hidden });
      // Audience clients treat a `hidden: true` update as a removal; host keeps it.
      emitQuestion(io, code, 'question:updated', q);
      scheduleAnalytics(io, code);
      return serializeQuestion(q, true);
    })
  );

  socket.on(
    'room:close',
    withAck(async (payload) => {
      const code = requireJoined(socket);
      requireHost(socket);
      roomCloseSchema.parse(payload ?? {});

      const room = await closeRoom(code);
      emitRoomUpdated(io, code, room.status);
      scheduleAnalytics(io, code);
      return room;
    })
  );
}
