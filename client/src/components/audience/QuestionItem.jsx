import { Icon } from '../shared/icons.jsx';

/**
 * A single question row with an upvote toggle. `mine` reflects the user's own upvote
 * state; the count is always whatever the server last broadcast.
 */
export function QuestionItem({ question, mine, onUpvote, disabled }) {
  const { text, upvoteCount, answered } = question;
  return (
    <li
      className={`flex animate-slide-up items-start gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors ${
        answered ? 'opacity-70' : ''
      }`}
    >
      <button
        onClick={() => onUpvote(question.id)}
        disabled={disabled}
        aria-pressed={mine}
        aria-label={mine ? 'Remove your upvote' : 'Upvote this question'}
        className={`flex min-w-[3rem] flex-col items-center justify-center rounded-xl border px-2 py-1.5 transition-colors duration-150 disabled:opacity-50 ${
          mine
            ? 'border-primary bg-primary text-primary-fg'
            : 'border-border bg-surface-2 text-fg hover:border-primary/60'
        }`}
      >
        <Icon.ChevronUp width={18} height={18} />
        <span className="tabular text-sm font-semibold leading-none">{upvoteCount}</span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-fg">{text}</p>
        {answered && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
            <Icon.Check width={13} height={13} />
            Answered
          </span>
        )}
      </div>
    </li>
  );
}
