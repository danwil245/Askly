import { useCallback, useEffect, useReducer, useRef } from 'react';
import { getSocket, emitAck } from '../socket/socket.js';
import { roomReducer, initialState } from '../state/roomReducer.js';

/**
 * Owns the socket lifecycle for a qa/mentor room: connect, join, resync on every
 * reconnect, and translate server events into reducer actions. Identity comes from the
 * socket handshake JWT; there is no hostToken in v2.
 */
export function useRoom(code) {
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const codeRef = useRef(code);
  const prevStatusRef = useRef(null);
  codeRef.current = code;

  const join = useCallback(async () => {
    try {
      const next = await emitAck('room:join', { code: codeRef.current });
      prevStatusRef.current = next.room?.status;
      dispatch({ type: 'ROOM_STATE', state: next });
    } catch (err) {
      dispatch({ type: 'FATAL', error: { code: err.code, message: err.message } });
    }
  }, []);

  useEffect(() => {
    if (!code) return undefined;
    const socket = getSocket();

    const onConnect = () => {
      dispatch({ type: 'CONNECTION', status: 'connected' });
      join();
    };
    const onDisconnect = () => dispatch({ type: 'CONNECTION', status: 'reconnecting' });
    const onConnectError = () => dispatch({ type: 'CONNECTION', status: 'reconnecting' });

    const onQuestionNew = (q) => dispatch({ type: 'QUESTION_NEW', question: q });
    const onQuestionUpdated = (q) => dispatch({ type: 'QUESTION_UPDATED', question: q });
    const onPollNew = (p) => dispatch({ type: 'POLL_NEW', poll: p });
    const onPollUpdated = (p) => dispatch({ type: 'POLL_UPDATED', poll: p });
    const onRoomUpdated = (payload) => {
      const wasClosed = prevStatusRef.current === 'closed';
      prevStatusRef.current = payload.status;
      dispatch({ type: 'ROOM_UPDATED', ...payload });
      // Reopened after being closed → resync full state.
      if (payload.status === 'open' && wasClosed) join();
    };
    const onSessionRenamed = ({ id, name }) => dispatch({ type: 'SESSION_RENAMED', id, name });
    const onPresence = ({ count }) => dispatch({ type: 'PRESENCE', count });
    const onAnalytics = (snapshot) => dispatch({ type: 'ANALYTICS', snapshot });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('question:new', onQuestionNew);
    socket.on('question:updated', onQuestionUpdated);
    socket.on('poll:new', onPollNew);
    socket.on('poll:updated', onPollUpdated);
    socket.on('room:updated', onRoomUpdated);
    socket.on('session:renamed', onSessionRenamed);
    socket.on('presence:updated', onPresence);
    socket.on('analytics:updated', onAnalytics);

    dispatch({ type: 'CONNECTION', status: 'connecting' });
    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('question:new', onQuestionNew);
      socket.off('question:updated', onQuestionUpdated);
      socket.off('poll:new', onPollNew);
      socket.off('poll:updated', onPollUpdated);
      socket.off('room:updated', onRoomUpdated);
      socket.off('session:renamed', onSessionRenamed);
      socket.off('presence:updated', onPresence);
      socket.off('analytics:updated', onAnalytics);
    };
  }, [code, join]);

  // --- bound actions ---
  const askQuestion = useCallback((text) => emitAck('question:ask', { text }), []);

  const upvoteQuestion = useCallback((questionId) => {
    dispatch({ type: 'OPTIMISTIC_UPVOTE', questionId });
    return emitAck('question:upvote', { questionId }).catch((err) => {
      dispatch({ type: 'OPTIMISTIC_UPVOTE', questionId }); // roll back
      throw err;
    });
  }, []);

  const votePoll = useCallback((pollId, optionId) => {
    dispatch({ type: 'OPTIMISTIC_VOTE', pollId, optionId });
    return emitAck('poll:vote', { pollId, optionId });
  }, []);

  const createPoll = useCallback(
    (question, options, durationSeconds) =>
      emitAck('poll:create', { question, options, durationSeconds }),
    []
  );
  const closePoll = useCallback((pollId) => emitAck('poll:close', { pollId }), []);
  const answerQuestion = useCallback(
    (questionId, answered) => emitAck('question:answer', { questionId, answered }),
    []
  );
  const hideQuestion = useCallback(
    (questionId, hidden) => emitAck('question:hide', { questionId, hidden }),
    []
  );
  const closeRoom = useCallback((sessionName) => emitAck('room:close', { sessionName }), []);
  const openRoom = useCallback(() => emitAck('room:open', {}), []);

  return {
    state,
    actions: {
      askQuestion,
      upvoteQuestion,
      votePoll,
      createPoll,
      closePoll,
      answerQuestion,
      hideQuestion,
      closeRoom,
      openRoom,
    },
  };
}
