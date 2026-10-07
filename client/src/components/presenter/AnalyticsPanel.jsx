import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { EmptyState } from '../shared/EmptyState.jsx';
import { Icon } from '../shared/icons.jsx';

function Tile({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`tabular mt-1 font-heading text-2xl font-bold ${accent || 'text-fg'}`}>
        {value}
      </p>
    </div>
  );
}

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Host analytics: totals tiles, questions-over-time line, top questions (spec section 11). */
export function AnalyticsPanel({ analytics }) {
  if (!analytics) {
    return (
      <EmptyState icon={Icon.Chart} title="Analytics are warming up">
        Numbers appear here as your audience asks questions and votes.
      </EmptyState>
    );
  }

  const { totals, answerRate, topQuestions, questionsOverTime } = analytics;
  const timeData = (questionsOverTime || []).map((b) => ({
    time: fmtTime(b.minute),
    count: b.count,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Questions" value={totals.questions} />
        <Tile label="Answered" value={totals.answered} accent="text-success" />
        <Tile label="Upvotes" value={totals.upvotes} accent="text-primary" />
        <Tile label="Participants" value={totals.uniqueParticipants} accent="text-accent" />
        <Tile label="Polls" value={totals.polls} />
        <Tile label="Votes" value={totals.votes} accent="text-primary" />
        <Tile label="Hidden" value={totals.hidden} accent="text-muted" />
        <Tile label="Answer rate" value={`${answerRate}%`} accent="text-success" />
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-heading text-base font-semibold">Questions over time</h3>
        {timeData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No questions yet.</p>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={timeData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgb(var(--border))' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgb(var(--surface))',
                    border: '1px solid rgb(var(--border))',
                    borderRadius: 12,
                    color: 'rgb(var(--fg))',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Questions"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0d9488' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-heading text-base font-semibold">Top questions</h3>
        {topQuestions?.length ? (
          <ol className="flex flex-col gap-2">
            {topQuestions.map((q, i) => (
              <li key={q.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
                <span className="tabular w-5 shrink-0 text-sm font-semibold text-muted">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-fg" title={q.text}>
                  {q.text}
                </span>
                <span className="tabular inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  <Icon.ChevronUp width={14} height={14} />
                  {q.upvoteCount}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-4 text-center text-sm text-muted">No questions yet.</p>
        )}
      </div>
    </div>
  );
}
