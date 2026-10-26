// Pure reducer applying server events (and optimistic local actions) to room state (v2).
// The server is the source of truth — counts are never computed here; optimistic toggles
// are reconciled by the next broadcast.

export const initialState = {
  connection: 'idle', // idle | connecting | connected | reconnecting | error
  room: null, // { code, title, type, status, chapter?, settings, spotlightQuestionId }
  isHost: false,
  currentSessionId: null,
  sessions: [], // [{ id, name, startedAt, endedAt, status }]
  questions: [], // question objects (each carries sessionId)
  polls: [],
  myVotes: {}, // { [pollId]: optionId }
  myUpvotes: [], // [questionId]
  presence: 0,
  analytics: null,
  fatal: null, // { code, message } — e.g. ROOM_NOT_FOUND / UNAUTHENTICATED
};

function upsert(list, item) {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [item, ...list];
  const next = list.slice();
  next[idx] = { ...next[idx], ...item };
  return next;
}

export function roomReducer(state, action) {
  switch (action.type) {
    case 'CONNECTION':
      return { ...state, connection: action.status };

    case 'FATAL':
      return { ...state, fatal: action.error, connection: 'error' };

    case 'ROOM_STATE': {
      const s = action.state;
      return {
        ...state,
        room: s.room,
        isHost: s.isHost,
        currentSessionId: s.currentSessionId,
        sessions: s.sessions || [],
        questions: s.questions,
        polls: s.polls,
        myVotes: s.myVotes || {},
        myUpvotes: s.myUpvotes || [],
        fatal: null,
        connection: 'connected',
      };
    }

    case 'QUESTION_NEW':
      return { ...state, questions: upsert(state.questions, action.question) };

    case 'QUESTION_UPDATED': {
      const q = action.question;
      if (q.hidden && !state.isHost) {
        return { ...state, questions: state.questions.filter((x) => x.id !== q.id) };
      }
      return { ...state, questions: upsert(state.questions, q) };
    }

    case 'POLL_NEW':
      return { ...state, polls: upsert(state.polls, action.poll) };

    case 'POLL_UPDATED':
      return { ...state, polls: upsert(state.polls, action.poll) };

    case 'SPOTLIGHT':
      return state.room
        ? { ...state, room: { ...state.room, spotlightQuestionId: action.questionId } }
        : state;

    case 'ROOM_UPDATED':
      return {
        ...state,
        room: state.room
          ? {
              ...state.room,
              status: action.status,
              // Closing a room clears the spotlight server-side.
              ...(action.status === 'closed' ? { spotlightQuestionId: null } : {}),
            }
          : state.room,
        currentSessionId: action.currentSessionId ?? state.currentSessionId,
        sessions: action.sessions || state.sessions,
      };

    case 'SESSION_RENAMED':
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.id ? { ...s, name: action.name } : s
        ),
      };

    case 'PRESENCE':
      return { ...state, presence: action.count };

    case 'ANALYTICS':
      return { ...state, analytics: action.snapshot };

    // --- optimistic local actions ---
    case 'OPTIMISTIC_UPVOTE': {
      const { questionId } = action;
      const had = state.myUpvotes.includes(questionId);
      const myUpvotes = had
        ? state.myUpvotes.filter((id) => id !== questionId)
        : [...state.myUpvotes, questionId];
      const questions = state.questions.map((q) =>
        q.id === questionId
          ? { ...q, upvoteCount: Math.max(0, (q.upvoteCount || 0) + (had ? -1 : 1)) }
          : q
      );
      return { ...state, myUpvotes, questions };
    }

    case 'OPTIMISTIC_VOTE':
      return { ...state, myVotes: { ...state.myVotes, [action.pollId]: action.optionId } };

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}
