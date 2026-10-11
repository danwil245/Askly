import { Link, useParams } from 'react-router-dom';
import { useQuiz } from '../hooks/useQuiz.js';
import { useToast } from '../hooks/useToast.jsx';
import { JoinCodeCard } from '../components/presenter/JoinCodeCard.jsx';
import { QuizOptionTile } from '../components/quiz/QuizOptionTile.jsx';
import { TimerRing } from '../components/quiz/TimerRing.jsx';
import { Leaderboard, Podium } from '../components/quiz/Leaderboard.jsx';
import { Logo } from '../components/shared/Logo.jsx';
import { ThemeToggle } from '../components/shared/ThemeToggle.jsx';
import { Button } from '../components/shared/Button.jsx';
import { ConnectionBadge } from '../components/shared/ConnectionBadge.jsx';
import { EmptyState } from '../components/shared/EmptyState.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { RoomNotFound } from './RoomNotFound.jsx';

export function QuizHost() {
  const { code: raw } = useParams();
  const code = raw?.toUpperCase();
  const { toast } = useToast();
  const { state, actions } = useQuiz(code, { asHost: true });

  const run = (fn) => async () => {
    try {
      await fn();
    } catch (err) {
      toast(err.message || 'Action failed', { variant: 'error' });
    }
  };

  if (state.fatal?.code === 'ROOM_NOT_FOUND') return <RoomNotFound code={code} />;
  if (state.fatal) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-5 text-center">
        <h1 className="font-heading text-2xl font-bold">Can’t host this game</h1>
        <p className="mt-2 text-sm text-muted">{state.fatal.message}</p>
        <Link to="/quiz" className="mt-6">
          <Button variant="outline">Back to quizzes</Button>
        </Link>
      </div>
    );
  }

  const q = state.question;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/quiz" aria-label="Back to quizzes">
            <Logo showWord={false} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium">
              <Icon.Users width={14} height={14} className="text-primary" />
              <span className="tabular">{state.count}</span> players
            </span>
            <ConnectionBadge status={state.connection} />
            <ThemeToggle />
            {state.phase && state.phase !== 'finished' && state.phase !== 'lobby' && (
              <Button variant="ghost" size="sm" onClick={run(actions.end)}>
                End game
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6">
        {/* LOBBY */}
        {state.phase === 'lobby' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <JoinCodeCard code={code} joinPath="/play/" />
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold">
                  Players ({state.players.length})
                </h2>
                <Button onClick={run(actions.start)} disabled={state.players.length < 1}>
                  Start game
                </Button>
              </div>
              {state.players.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  Waiting for players to join with the code…
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {state.players.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pl-3 pr-1 text-sm"
                    >
                      {p.nickname}
                      <button
                        onClick={run(() => actions.kick(p.id))}
                        aria-label={`Kick ${p.nickname}`}
                        className="rounded-full p-1 text-muted hover:bg-danger/15 hover:text-danger"
                      >
                        <Icon.X width={14} height={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* QUESTION */}
        {state.phase === 'question' && q && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <span className="text-sm text-muted">
                Question {q.index + 1} of {q.total}
              </span>
              <div className="flex items-center gap-4">
                <span className="tabular text-sm text-muted">
                  {state.answerCount.answered}/{state.answerCount.total} answered
                </span>
                <TimerRing endsAt={q.endsAt} totalMs={q.timeLimitSec * 1000} skew={state.skew} />
                <Button variant="outline" onClick={run(actions.skip)}>
                  Skip
                </Button>
              </div>
            </div>
            <h1 className="mb-6 font-heading text-3xl font-bold">{q.text}</h1>
            <div className="grid gap-3 sm:grid-cols-2">
              {q.options.map((o, i) => (
                <QuizOptionTile key={o.id} index={i} text={o.text} disabled />
              ))}
            </div>
          </div>
        )}

        {/* REVEAL */}
        {state.phase === 'reveal' && q && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="font-heading text-2xl font-bold">Results</h1>
              <Button onClick={run(actions.next)}>
                Next
                <Icon.ArrowRight width={16} height={16} />
              </Button>
            </div>
            <h2 className="mb-5 text-lg text-muted">{q.text}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {q.options.map((o, i) => {
                const dist = state.reveal?.distribution || {};
                const total = Object.values(dist).reduce((s, n) => s + n, 0);
                const pct = total ? Math.round(((dist[o.id] || 0) / total) * 100) : 0;
                const isCorrect = o.id === state.reveal?.correctOptionId;
                return (
                  <QuizOptionTile
                    key={o.id}
                    index={i}
                    text={o.text}
                    disabled
                    percent={pct}
                    status={isCorrect ? 'correct' : 'dim'}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* LEADERBOARD */}
        {state.phase === 'leaderboard' && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h1 className="font-heading text-2xl font-bold">Leaderboard</h1>
              <Button onClick={run(actions.next)}>
                {state.index + 1 >= state.total ? 'Finish' : 'Next question'}
                <Icon.ArrowRight width={16} height={16} />
              </Button>
            </div>
            <Leaderboard entries={state.leaderboard.top} />
          </div>
        )}

        {/* FINISHED */}
        {state.phase === 'finished' && (
          <div>
            <h1 className="mb-6 text-center font-heading text-3xl font-bold">🏆 Final results</h1>
            <div className="mb-8">
              <Podium entries={state.finalLeaderboard || []} />
            </div>
            <Leaderboard entries={state.finalLeaderboard || []} />
            <div className="mt-8 text-center">
              <Link to="/quiz">
                <Button variant="outline">Back to quizzes</Button>
              </Link>
            </div>
          </div>
        )}

        {!state.phase && (
          <EmptyState icon={Icon.Trophy} title="Connecting to your game…">
            Setting things up.
          </EmptyState>
        )}
      </main>
    </div>
  );
}
