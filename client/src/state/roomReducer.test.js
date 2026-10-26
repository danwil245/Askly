import { describe, it, expect } from 'vitest';
import { roomReducer, initialState } from './roomReducer.js';

const base = () => ({ ...initialState });

describe('roomReducer', () => {
  it('applies ROOM_STATE including sessions + currentSessionId', () => {
    const s = roomReducer(base(), {
      type: 'ROOM_STATE',
      state: {
        room: { code: 'ABC123', title: 'T', type: 'qa', status: 'open' },
        isHost: true,
        currentSessionId: 's1',
        sessions: [{ id: 's1', name: 'One' }],
        questions: [{ id: 'q1', upvoteCount: 0 }],
        polls: [],
        myVotes: {},
        myUpvotes: [],
      },
    });
    expect(s.isHost).toBe(true);
    expect(s.currentSessionId).toBe('s1');
    expect(s.sessions).toHaveLength(1);
    expect(s.connection).toBe('connected');
  });

  it('removes a question for the audience when it becomes hidden', () => {
    let s = { ...base(), isHost: false, questions: [{ id: 'q1', hidden: false }] };
    s = roomReducer(s, { type: 'QUESTION_UPDATED', question: { id: 'q1', hidden: true } });
    expect(s.questions).toHaveLength(0);
  });

  it('keeps a hidden question for the host', () => {
    let s = { ...base(), isHost: true, questions: [{ id: 'q1', hidden: false }] };
    s = roomReducer(s, { type: 'QUESTION_UPDATED', question: { id: 'q1', hidden: true } });
    expect(s.questions).toHaveLength(1);
    expect(s.questions[0].hidden).toBe(true);
  });

  it('optimistically toggles an upvote and reconciles count', () => {
    let s = { ...base(), questions: [{ id: 'q1', upvoteCount: 2 }], myUpvotes: [] };
    s = roomReducer(s, { type: 'OPTIMISTIC_UPVOTE', questionId: 'q1' });
    expect(s.myUpvotes).toContain('q1');
    expect(s.questions[0].upvoteCount).toBe(3);
    s = roomReducer(s, { type: 'OPTIMISTIC_UPVOTE', questionId: 'q1' });
    expect(s.myUpvotes).not.toContain('q1');
    expect(s.questions[0].upvoteCount).toBe(2);
  });

  it('updates status + sessions on ROOM_UPDATED', () => {
    let s = { ...base(), room: { code: 'A', status: 'open' } };
    s = roomReducer(s, {
      type: 'ROOM_UPDATED',
      status: 'closed',
      currentSessionId: null,
      sessions: [{ id: 's1' }, { id: 's2' }],
    });
    expect(s.room.status).toBe('closed');
    expect(s.sessions).toHaveLength(2);
  });

  it('renames a session', () => {
    let s = { ...base(), sessions: [{ id: 's1', name: 'Old' }] };
    s = roomReducer(s, { type: 'SESSION_RENAMED', id: 's1', name: 'New' });
    expect(s.sessions[0].name).toBe('New');
  });

  it('sets and clears the spotlighted question', () => {
    let s = { ...base(), room: { code: 'ABC123', status: 'open', spotlightQuestionId: null } };
    s = roomReducer(s, { type: 'SPOTLIGHT', questionId: 'q1' });
    expect(s.room.spotlightQuestionId).toBe('q1');
    s = roomReducer(s, { type: 'SPOTLIGHT', questionId: null });
    expect(s.room.spotlightQuestionId).toBeNull();
  });

  it('clears the spotlight when the room closes', () => {
    let s = { ...base(), room: { code: 'ABC123', status: 'open', spotlightQuestionId: 'q1' } };
    s = roomReducer(s, { type: 'ROOM_UPDATED', status: 'closed', currentSessionId: null });
    expect(s.room.status).toBe('closed');
    expect(s.room.spotlightQuestionId).toBeNull();
  });
});
