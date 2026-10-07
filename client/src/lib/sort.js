// Client-side sorting (spec section 9): unanswered first, by upvoteCount desc then
// newest; answered pushed to the bottom.
export function sortQuestions(questions) {
  return [...questions].sort((a, b) => {
    if (!!a.answered !== !!b.answered) return a.answered ? 1 : -1;
    if ((b.upvoteCount || 0) !== (a.upvoteCount || 0)) {
      return (b.upvoteCount || 0) - (a.upvoteCount || 0);
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

export function splitQuestions(questions) {
  const visible = [];
  const hidden = [];
  for (const q of questions) (q.hidden ? hidden : visible).push(q);
  return { visible: sortQuestions(visible), hidden: sortQuestions(hidden) };
}
