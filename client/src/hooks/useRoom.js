import { useCallback, useEffect, useReducer, useRef } from 'react';
import { getSocket, emitAck } from '../socket/socket.js';
import { getClientId } from '../lib/clientId.js';
import { roomReducer, initialState } from '../state/roomReducer.js';

/**
 * Owns the socket lifecycle for a room: connect, join, resync on every reconnect,
 * and translate server events into reducer actions. Returns state + bound actions.
 *
 * @param {string} code      room join code
 * @param {string} [hostToken] host token if this client is the presenter
 */
export function useRoom(code, hostToken) {
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const codeRef = useRef(code);
  const tokenRef = useRef(hostToken);
  codeRef.current = code;
  tokenRef.current = hostToken;

  // Join (and resync) by emitting room:join; its ack carries the full room:state.
  const join = useCallback(async () => {
    try {
      const state = await emitAck('room:join', {
        code: codeRef.current,
        clientId: getClientId(),
        hostToken: tokenRef.current || undefined,
      });
      dispatch({ type: 'ROOM_STATE', state });
    } catch (err) {
      dispatch({ type: 'FATAL', error: { code: err.code, message: err.message } });
    }
  }, []);

  useEffect(() => {
    if (!code) return undefined;
    const socket = getSocket();

    const onConnect = () => {
      dispatch({ type: 'CONNECTION', status: 'connected' });
      // Re-emit join on every (re)connect to resync full state.
      join();
    };
    const onDisconnect = () => dispatch({ type: 'CONNECTION', status: 'reconnecting' });
    const onConnectError = () => dispatch({ type: 'CONNECTION', status: 'reconnecting' });

    const onQuestionNew = (q) => dispatch({ type: 'QUESTION_NEW', question: q });
    const onQuestionUpdated = (q) => dispatch({ type: 'QUESTION_UPDATED', question: q });
    const onPollNew = (p) => dispatch({ type: 'POLL_NEW', poll: p });
    const onPollUpdated = (p) => dispatch({ type: 'POLL_UPDATED', poll: p });
    const onRoomUpdated = ({ status }) => dispatch({ type: 'ROOM_UPDATED', status });
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
      socket.off('presence:updated', onPresence);
      socket.off('analytics:updated', onAnalytics);
    };
  }, [code, join]);

  // --- bound actions (return the ack promise so callers can toast on error) ---
  const askQuestion = useCallback((text) => emitAck('question:ask', { text }), []);

  const upvoteQuestion = useCallback((questionId) => {
    dispatch({ type: 'OPTIMISTIC_UPVOTE', questionId }); // optimistic; server reconciles
    return emitAck('question:upvote', { questionId }).catch((err) => {
      // Roll back the optimistic toggle on failure.
      dispatch({ type: 'OPTIMISTIC_UPVOTE', questionId });
      throw err;
    });
  }, []);

  const votePoll = useCallback((pollId, optionId) => {
    dispatch({ type: 'OPTIMISTIC_VOTE', pollId, optionId });
    return emitAck('poll:vote', { pollId, optionId });
  }, []);

  const createPoll = useCallback(
    (question, options) => emitAck('poll:create', { question, options }),
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
  const closeRoom = useCallback(() => emitAck('room:close', {}), []);

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
    },
  };
}
