import { useCallback, useEffect, useReducer, useRef } from 'react';
import { getSocket, emitAck } from '../socket/socket.js';
import { getClientId } from '../lib/clientId.js';
import { quizReducer, initialQuizState } from '../state/quizReducer.js';

/**
 * Socket lifecycle for a quiz game, for both host and player.
 * @param {string} code
 * @param {{ asHost?: boolean }} opts
 */
export function useQuiz(code, { asHost = false } = {}) {
  const [state, dispatch] = useReducer(quizReducer, initialQuizState);
  const nickRef = useRef(null); // player's nickname for auto-rejoin on reconnect

  const hostJoin = useCallback(async () => {
    try {
      const snap = await emitAck('quiz:host:join', { code });
      dispatch({ type: 'HOST_SNAPSHOT', snap });
    } catch (err) {
      dispatch({ type: 'FATAL', error: { code: err.code, message: err.message } });
    }
  }, [code]);

  const join = useCallback(
    async (nickname) => {
      nickRef.current = nickname;
      const data = await emitAck('quiz:join', { code, nickname, clientId: getClientId() });
      dispatch({ type: 'JOINED', data });
      return data;
    },
    [code]
  );

  useEffect(() => {
    if (!code) return undefined;
    const socket = getSocket();

    const onConnect = () => {
      dispatch({ type: 'CONNECTION', status: 'connected' });
      if (asHost) hostJoin();
      else if (nickRef.current) join(nickRef.current).catch(() => {}); // rejoin after reconnect
    };
    const onDisconnect = () => dispatch({ type: 'CONNECTION', status: 'reconnecting' });

    const handlers = {
      'quiz:state': (snap) => dispatch({ type: 'STATE', snap }),
      'quiz:players': (p) => dispatch({ type: 'PLAYERS', count: p.count, players: p.players }),
      'quiz:question': (p) => dispatch({ type: 'QUESTION', payload: p }),
      'quiz:answer-count': (p) => dispatch({ type: 'ANSWER_COUNT', ...p }),
      'quiz:reveal': (p) => dispatch({ type: 'REVEAL', payload: p }),
      'quiz:result': (p) => dispatch({ type: 'RESULT', payload: p }),
      'quiz:leaderboard': (p) => dispatch({ type: 'LEADERBOARD', payload: p }),
      'quiz:finished': (p) => dispatch({ type: 'FINISHED', payload: p }),
      'quiz:kicked': () => dispatch({ type: 'KICKED' }),
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    for (const [event, fn] of Object.entries(handlers)) socket.on(event, fn);

    dispatch({ type: 'CONNECTION', status: 'connecting' });
    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      for (const [event, fn] of Object.entries(handlers)) socket.off(event, fn);
    };
  }, [code, asHost, hostJoin, join]);

  // Player action
  const answer = useCallback(
    (optionId) => emitAck('quiz:answer', { questionId: state.question?.questionId, optionId }),
    [state.question]
  );

  // Host actions
  const start = useCallback(() => emitAck('quiz:start', {}), []);
  const skip = useCallback(() => emitAck('quiz:skip', {}), []);
  const next = useCallback(() => emitAck('quiz:next', {}), []);
  const end = useCallback(() => emitAck('quiz:end', {}), []);
  const kick = useCallback((playerId) => emitAck('quiz:kick', { playerId }), []);

  return { state, join, answer, actions: { start, skip, next, end, kick } };
}
