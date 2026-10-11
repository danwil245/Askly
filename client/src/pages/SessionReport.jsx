import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/http.js';
import { HubLayout } from '../components/hubs/HubLayout.jsx';
import { EmptyState } from '../components/shared/EmptyState.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { useToast } from '../hooks/useToast.jsx';

function PollResult({ poll }) {
  return (
    <div className="card p-4">
      <h4 className="font-heading text-sm font-semibold">{poll.question}</h4>
      <div className="mt-2 flex flex-col gap-1.5">
        {poll.options.map((o, i) => (
          <div key={i} className="relative overflow-hidden rounded-lg border border-border px-3 py-1.5">
            <div
              className="absolute inset-y-0 left-0 bg-primary/15"
              style={{ width: `${o.percent}%` }}
              aria-hidden
            />
            <div className="relative flex justify-between text-sm">
              <span>{o.text}</span>
              <span className="tabular text-muted">
                {o.percent}% · {o.votes}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 tabular text-xs text-muted">{poll.totalVotes} votes</p>
    </div>
  );
}

function QaReport({ report }) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-muted">
          Questions ({report.questions.length})
        </h2>
        {report.questions.length === 0 ? (
          <p className="text-sm text-muted">No questions in this session.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.questions.map((q) => (
              <li key={q.id} className="card flex items-start gap-3 p-3">
                <span className="tabular inline-flex min-w-[2.5rem] items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-sm font-semibold text-primary">
                  <Icon.ChevronUp width={14} height={14} />
                  {q.upvoteCount}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-fg">{q.text}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {q.authorName}
                    {q.answered && ' · answered'}
                    {q.hidden && ' · hidden'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.polls.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-muted">
            Polls ({report.polls.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.polls.map((p) => (
              <PollResult key={p.id} poll={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function QuizReport({ report }) {
  const board = report.quiz?.finalLeaderboard || [];
  return (
    <section>
      <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-muted">
        Final leaderboard
      </h2>
      {report.quiz?.interrupted && (
        <p className="mb-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          This game was interrupted before it finished.
        </p>
      )}
      {board.length === 0 ? (
        <p className="text-sm text-muted">No results recorded.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {board.map((p) => (
            <li key={`${p.rank}-${p.nickname}`} className="card flex items-center gap-3 p-3">
              <span className="tabular w-6 text-center font-heading text-lg font-bold text-primary">
                {p.rank}
              </span>
              <span className="flex-1 text-sm font-medium">{p.nickname}</span>
              <span className="text-xs text-muted">{p.correctCount} correct</span>
              <span className="tabular font-heading font-bold">{p.score}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function SessionReport() {
  const { sessionId } = useParams();
  const { toast } = useToast();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getSession(sessionId)
      .then((r) => !cancelled && setReport(r))
      .catch((err) => {
        if (cancelled) return;
        setError(true);
        toast(err.message || 'Could not load report', { variant: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, toast]);

  const isQuiz = report?.room?.type === 'quiz';

  return (
    <HubLayout
      title={report ? report.session.name : 'Session report'}
      subtitle={report ? `${report.room.title} · ${report.room.code}` : ''}
    >
      {error ? (
        <EmptyState icon={Icon.X} title="Report unavailable">
          We couldn’t load this session.
        </EmptyState>
      ) : !report ? (
        <p className="py-10 text-center text-sm text-muted">Loading…</p>
      ) : isQuiz ? (
        <QuizReport report={report} />
      ) : (
        <QaReport report={report} />
      )}
    </HubLayout>
  );
}
