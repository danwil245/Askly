/**
 * Shape DB documents for the wire. The core rule (spec section 8): non-hosts never
 * receive the `upvotes` array or `authorId` — only `upvoteCount`.
 */

export function serializeRoom(room) {
  return { code: room.code, title: room.title, status: room.status };
}

/**
 * @param {object} q        Question document or lean object
 * @param {boolean} isHost  Whether the recipient is the host
 */
export function serializeQuestion(q, isHost) {
  const base = {
    id: String(q._id),
    roomCode: q.roomCode,
    text: q.text,
    upvoteCount: q.upvoteCount ?? (q.upvotes?.length || 0),
    answered: !!q.answered,
    hidden: !!q.hidden,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
  if (isHost) {
    base.authorId = q.authorId;
    base.upvotes = q.upvotes || [];
  }
  return base;
}

export function serializePoll(poll) {
  return {
    id: String(poll._id),
    roomCode: poll.roomCode,
    question: poll.question,
    status: poll.status,
    options: (poll.options || []).map((o) => ({ id: o.id, text: o.text, votes: o.votes || 0 })),
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
  };
}
