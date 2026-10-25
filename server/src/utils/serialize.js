/**
 * Shape DB documents for the wire (v2).
 *
 * Author-name visibility (spec section 8): the host always sees the real asker name;
 * the audience sees it only when room.settings.showAuthorNames === 'all', otherwise
 * "Anonymous". Non-hosts never receive `authorUserId` or the `upvotes` array.
 */

export function serializeRoom(room, { chapter } = {}) {
  return {
    code: room.code,
    title: room.title,
    type: room.type,
    status: room.status,
    currentSessionId: room.currentSessionId ? String(room.currentSessionId) : null,
    activeQuizCode: room.activeQuizCode || null,
    settings: { showAuthorNames: room.settings?.showAuthorNames || 'host' },
    ...(chapter ? { chapter: serializeChapter(chapter) } : {}),
  };
}

/** Public room meta for the landing join box (routes by type). */
export function serializeRoomMeta(room) {
  return { code: room.code, title: room.title, type: room.type, status: room.status };
}

export function serializeSession(s) {
  return {
    id: String(s._id),
    name: s.name,
    status: s.status,
    startedAt: s.startedAt,
    endedAt: s.endedAt || null,
  };
}

export function serializeChapter(c) {
  return {
    id: String(c._id),
    name: c.name,
    description: c.description || '',
    archived: !!c.archived,
  };
}

/**
 * @param {object} q
 * @param {{ isHost: boolean, showNames: boolean }} opts
 *   showNames = room.settings.showAuthorNames === 'all'
 */
export function serializeQuestion(q, { isHost, showNames } = {}) {
  const base = {
    id: String(q._id),
    roomCode: q.roomCode,
    sessionId: String(q.sessionId),
    text: q.text,
    upvoteCount: q.upvoteCount ?? (q.upvotes?.length || 0),
    answered: !!q.answered,
    hidden: !!q.hidden,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    authorName: isHost || showNames ? q.authorName : 'Anonymous',
  };
  if (isHost) {
    base.authorUserId = String(q.authorUserId);
    base.upvotes = q.upvotes || [];
  }
  return base;
}

export function serializePoll(poll) {
  return {
    id: String(poll._id),
    roomCode: poll.roomCode,
    sessionId: String(poll.sessionId),
    question: poll.question,
    status: poll.status,
    closesAt: poll.closesAt || null,
    options: (poll.options || []).map((o) => ({ id: o.id, text: o.text, votes: o.votes || 0 })),
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
  };
}
