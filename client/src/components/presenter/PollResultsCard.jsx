import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Button } from '../shared/Button.jsx';
import { Icon } from '../shared/icons.jsx';
import { PollCountdown } from '../shared/PollCountdown.jsx';

const BAR_COLORS = ['#0d9488', '#4f46e5', '#0369a1', '#0891b2', '#7c3aed', '#059669'];

/** Presenter live poll results as a horizontal bar chart with a Close control. */
export function PollResultsCard({ poll, onClose }) {
  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  const closed = poll.status === 'closed';
  const data = poll.options.map((o) => ({
    name: o.text,
    votes: o.votes,
    pct: total ? Math.round((o.votes / total) * 100) : 0,
  }));

  return (
    <section className="card p-4" aria-label={`Poll results: ${poll.question}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-heading text-base font-semibold leading-snug">{poll.question}</h3>
        {closed ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
            <Icon.Lock width={12} height={12} /> Closed
          </span>
        ) : (
          <Button variant="outline" size="sm" onClick={() => onClose(poll.id)}>
            <Icon.Lock width={14} height={14} />
            Close
          </Button>
        )}
      </div>

      {!closed && poll.closesAt && (
        <p
          className="-mt-2 mb-3 flex items-center gap-1 text-xs font-medium text-warning"
          aria-live="polite"
        >
          <Icon.Clock width={13} height={13} />
          <PollCountdown closesAt={poll.closesAt} />
        </p>
      )}

      {total === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Waiting for the first vote…</p>
      ) : (
        <div style={{ width: '100%', height: Math.max(120, data.length * 48) }}>
          <ResponsiveContainer>
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 0, right: 48, bottom: 0, left: 8 }}
              barCategoryGap={10}
            >
              <XAxis type="number" hide domain={[0, Math.max(1, ...data.map((d) => d.votes))]} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgb(var(--surface-2))' }}
                contentStyle={{
                  background: 'rgb(var(--surface))',
                  border: '1px solid rgb(var(--border))',
                  borderRadius: 12,
                  color: 'rgb(var(--fg))',
                  fontSize: 12,
                }}
                formatter={(value, _n, item) => [`${value} votes (${item.payload.pct}%)`, 'Votes']}
              />
              <Bar dataKey="votes" radius={[6, 6, 6, 6]} isAnimationActive={false}>
                {data.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
                <LabelList
                  dataKey="pct"
                  position="right"
                  formatter={(v) => `${v}%`}
                  style={{ fill: 'rgb(var(--fg))', fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-2 tabular text-xs text-muted">
        {total} {total === 1 ? 'vote' : 'votes'}
      </p>
    </section>
  );
}
