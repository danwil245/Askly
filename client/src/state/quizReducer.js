// State for both the quiz host and player views. The server is authoritative for phase,
// timing, scoring, and correctness; the client only renders what it receives.

export const initialQuizState = {
  connection: 'idle',
  phase: null, // lobby | question | reveal | leaderboard | finished
  index: -1,
  total: 0,
  question: null, // { questionId, text, options, timeLimitSec, endsAt, serverNow }
  players: [], // host: full list
  count: 0,
  answerCount: { answered: 0, total: 0 }, // host
  reveal: null, // { correctOptionId, distribution }
  myResult: null, // player: { correct, pointsEarned, totalScore }
  leaderboard: { top: [], total: 0, yourRank: null, yourScore: null },
  finalLeaderboard: null,
  me: null, // player: { nickname, score }
  joined: false,
  kicked: false,
  fatal: null,
  skew: 0, // serverNow - clientNow, to correct the countdown
};

function applyState(state, snap) {
  const next = {
    ...state,
    phase: snap.phase,
    index: snap.index ?? state.index,
    total: snap.total ?? state.total,
  };
  if (snap.players) next.players = snap.players;
  if (snap.question) {
    next.question = snap.question;
    if (snap.endsAt) next.question = { ...snap.question, endsAt: snap.endsAt };
    if (snap.serverNow) next.skew = snap.serverNow - Date.now();
  }
  if (snap.reveal) next.reveal = snap.reveal;
  if (snap.leaderboard) next.leaderboard = { ...next.leaderboard, top: snap.leaderboard, total: snap.leaderboard.length };
  if (snap.me) next.me = snap.me;
  return next;
}

export function quizReducer(state, action) {
  switch (action.type) {
    case 'CONNECTION':
      return { ...state, connection: action.status };
    case 'FATAL':
      return { ...state, fatal: action.error };

    case 'STATE':
      return applyState(state, action.snap);

    case 'HOST_SNAPSHOT':
      return { ...applyState(state, action.snap), players: action.snap.players || state.players };

    case 'JOINED':
      return {
        ...applyState(state, action.data.state),
        joined: true,
        me: action.data.state?.me || { nickname: action.data.player?.nickname, score: 0 },
      };

    case 'PLAYERS':
      return { ...state, count: action.count, players: action.players || state.players };

    case 'QUESTION':
      return {
        ...state,
        phase: 'question',
        index: action.payload.index,
        total: action.payload.total,
        question: action.payload,
        reveal: null,
        myResult: null,
        skew: action.payload.serverNow ? action.payload.serverNow - Date.now() : state.skew,
      };

    case 'ANSWER_COUNT':
      return { ...state, answerCount: { answered: action.answered, total: action.total } };

    case 'REVEAL':
      return { ...state, phase: 'reveal', reveal: action.payload };

    case 'RESULT':
      return {
        ...state,
        myResult: action.payload,
        me: state.me ? { ...state.me, score: action.payload.totalScore } : state.me,
      };

    case 'LEADERBOARD':
      return {
        ...state,
        phase: 'leaderboard',
        leaderboard: {
          top: action.payload.top,
          total: action.payload.total,
          yourRank: action.payload.yourRank ?? state.leaderboard.yourRank,
          yourScore: action.payload.yourScore ?? state.leaderboard.yourScore,
        },
      };

    case 'FINISHED':
      return { ...state, phase: 'finished', finalLeaderboard: action.payload.leaderboard };

    case 'KICKED':
      return { ...state, kicked: true };

    default:
      return state;
  }
}
