import { Icon } from '../shared/icons.jsx';

/**
 * Poll card for the audience. Before voting: large tap targets. After voting (or when
 * closed): live results with the user's own choice highlighted. The server owns counts.
 */
export function PollVoteCard({ poll, myOptionId, onVote, disabled }) {
  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  const voted = !!myOptionId;
  const closed = poll.status === 'closed';
  const showResults = voted || closed;

  return (
    <section className="card animate-slide-up p-4" aria-label={`Poll: ${poll.question}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-heading text-base font-semibold leading-snug text-fg">
          {poll.question}
        </h3>
        {closed && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
            <Icon.Lock width={12} height={12} />
            Closed
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {poll.options.map((opt) => {
          const pct = total ? Math.round((opt.votes / total) * 100) : 0;
          const mine = opt.id === myOptionId;

          if (showResults) {
            return (
              <div
                key={opt.id}
                className={`relative overflow-hidden rounded-xl border px-3 py-2.5 ${
                  mine ? 'border-primary' : 'border-border'
                }`}
              >
                <div
                  className={`absolute inset-y-0 left-0 ${mine ? 'bg-primary/20' : 'bg-surface-2'}`}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                    {mine && <Icon.Check width={15} height={15} className="text-primary" />}
                    {opt.text}
                  </span>
                  <span className="tabular text-sm font-semibold text-muted">
                    {pct}% · {opt.votes}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <button
              key={opt.id}
              onClick={() => onVote(poll.id, opt.id)}
              disabled={disabled}
              className="min-h-[48px] rounded-xl border border-border bg-surface-2 px-4 py-3 text-left text-sm font-medium text-fg transition-colors hover:border-primary hover:bg-primary/5 active:scale-[0.99] disabled:opacity-50"
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      <p className="mt-3 tabular text-xs text-muted">
        {total} {total === 1 ? 'vote' : 'votes'}
        {!showResults && ' · tap an option to vote'}
      </p>
    </section>
  );
}
