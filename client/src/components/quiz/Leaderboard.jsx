import { Icon } from '../shared/icons.jsx';

export function Leaderboard({ entries, highlightNickname }) {
  if (!entries?.length) return <p className="text-center text-sm text-muted">No scores yet.</p>;
  return (
    <ol className="mx-auto flex max-w-md flex-col gap-2">
      {entries.map((e) => {
        const mine = e.nickname === highlightNickname;
        return (
          <li
            key={`${e.rank}-${e.nickname}`}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
              mine ? 'border-primary bg-primary/10' : 'border-border bg-surface'
            }`}
          >
            <span className="tabular w-7 text-center font-heading text-lg font-bold text-primary">
              {e.rank}
            </span>
            <span className="flex-1 truncate font-medium">{e.nickname}</span>
            {e.correctCount != null && (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Icon.Check width={12} height={12} />
                {e.correctCount}
              </span>
            )}
            <span className="tabular font-heading font-bold">{e.score}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Podium({ entries }) {
  const top3 = entries.slice(0, 3);
  // Render order: 2nd, 1st, 3rd
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = { 1: 'h-28', 2: 'h-20', 3: 'h-16' };
  const medal = { 1: 'bg-amber-400', 2: 'bg-slate-300', 3: 'bg-orange-400' };
  return (
    <div className="flex items-end justify-center gap-3">
      {order.map((e) => (
        <div key={e.nickname} className="flex w-24 flex-col items-center">
          <span className="mb-1 max-w-full truncate text-sm font-medium">{e.nickname}</span>
          <span className="tabular mb-1 font-heading text-lg font-bold">{e.score}</span>
          <div
            className={`flex w-full items-start justify-center rounded-t-xl pt-2 text-xl font-bold text-slate-900 ${heights[e.rank] || 'h-16'} ${medal[e.rank] || 'bg-surface-2'}`}
          >
            {e.rank}
          </div>
        </div>
      ))}
    </div>
  );
}
