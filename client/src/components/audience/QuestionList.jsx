import { useMemo } from 'react';
import { QuestionItem } from './QuestionItem.jsx';
import { EmptyState } from '../shared/EmptyState.jsx';
import { Icon } from '../shared/icons.jsx';
import { sortQuestions } from '../../lib/sort.js';

/** Audience question list: live-sorted, with the user's own upvotes highlighted. */
export function QuestionList({ questions, myUpvotes, onUpvote, disabled, spotlightId }) {
  const sorted = useMemo(() => sortQuestions(questions), [questions]);
  const mySet = useMemo(() => new Set(myUpvotes), [myUpvotes]);

  if (sorted.length === 0) {
    return (
      <EmptyState icon={Icon.Message} title="No questions yet">
        Be the first to ask — your question appears here instantly.
      </EmptyState>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {sorted.map((q) => (
        <QuestionItem
          key={q.id}
          question={q}
          mine={mySet.has(q.id)}
          onUpvote={onUpvote}
          disabled={disabled}
          spotlighted={q.id === spotlightId}
        />
      ))}
    </ul>
  );
}
