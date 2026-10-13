import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/http.js';
import { useQuiz } from '../hooks/useQuiz.js';
import { NicknameForm } from '../components/quiz/NicknameForm.jsx';
import { QuizOptionTile } from '../components/quiz/QuizOptionTile.jsx';
import { TimerRing } from '../components/quiz/TimerRing.jsx';
import { Leaderboard, Podium } from '../components/quiz/Leaderboard.jsx';
import { Logo } from '../components/shared/Logo.jsx';
import { ThemeToggle } from '../components/shared/ThemeToggle.jsx';
import { Button } from '../components/shared/Button.jsx';
import { RoomNotFound } from './RoomNotFound.jsx';

function Shell({ children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/" aria-label="Askly home">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-10">{children}</main>
    </div>
  );
}

export function QuizPlayer() {
  const { code } = useParams();
  const [meta, setMeta] = useState(undefined); // undefined=loading, null=not found
  const { state, join, answer } = useQuiz(code?.toUpperCase(), { asHost: false });
  const [selected, setSelected] = useState(null);
  const [answeredQ, setAnsweredQ] = useState(null);

  useEffect(() => {
    api
      .getRoom(code)
      .then((m) => setMeta(m.type === 'quiz' ? m : null))
      .catch(() => setMeta(null));
  }, [code]);

  // Reset answer state when a new question starts.
  useEffect(() => {
    if (state.phase === 'question' && state.question?.questionId !== answeredQ) {
      setSelected(null);
    }
  }, [state.phase, state.question, answeredQ]);

  if (meta === null) return <RoomNotFound code={code} />;
  if (meta === undefined) return <Shell>Loading…</Shell>;

  if (state.kicked) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold">You’ve left the game</h1>
          <p className="mt-2 text-sm text-muted">The host removed you from this quiz.</p>
          <Link to="/" className="mt-6 inline-block">
            <Button variant="outline">Back to home</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  if (!state.joined) {
    return (
      <Shell>
        <NicknameForm roomTitle={meta.title} onJoin={join} />
      </Shell>
    );
  }

  const q = state.question;
  const answered = answeredQ === q?.questionId;

  const submit = useCallback(
    async (optionId) => {
      if (!q) return;
      setSelected(optionId);
      setAnsweredQ(q.questionId);
      try {
        await answer(optionId);
      } catch {
        setSelected(null);
        setAnsweredQ(null);
      }
    },
    [q, answer]
  );

  // Allow keyboard shortcuts (1-4 and A-D) to select an answer option during the question phase.
  useEffect(() => {
    if (state.phase !== 'question' || !q || answered) return;

    const onKeyDown = (e) => {
      if (e.target.matches?.('input, textarea, select') || e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }
      const key = e.key.toUpperCase();
      let optIdx = -1;
      if (['1', '2', '3', '4'].includes(key)) {
        optIdx = Number(key) - 1;
      } else if (['A', 'B', 'C', 'D'].includes(key)) {
        optIdx = key.charCodeAt(0) - 65;
      }
      if (optIdx >= 0 && optIdx < q.options.length) {
        e.preventDefault();
        submit(q.options[optIdx].id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.phase, q, answered, submit]);

  return (
    <Shell>
      <div className="w-full max-w-lg">
        {/* score chip */}
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="font-medium">{state.me?.nickname}</span>
          <span className="tabular rounded-full bg-surface-2 px-3 py-1 font-semibold">
            {state.me?.score ?? 0} pts
          </span>
        </div>

        {state.phase === 'lobby' && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <h1 className="font-heading text-xl font-bold">You’re in!</h1>
            <p className="mt-1 text-sm text-muted">Waiting for the host to start…</p>
          </div>
        )}

        {state.phase === 'question' && q && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <span className="text-xs text-muted">
                Question {q.index + 1} of {q.total}
              </span>
              <TimerRing endsAt={q.endsAt} totalMs={q.timeLimitSec * 1000} skew={state.skew} size={56} />
            </div>
            <h1 className="mb-5 font-heading text-xl font-semibold">{q.text}</h1>
            {answered ? (
              <p className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-muted">
                Answer locked in — hang tight!
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {q.options.map((o, i) => (
                  <QuizOptionTile
                    key={o.id}
                    index={i}
                    text={o.text}
                    status={selected === o.id ? 'selected' : 'idle'}
                    onClick={() => submit(o.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {state.phase === 'reveal' && q && (
          <div>
            <div
              className={`mb-4 rounded-2xl p-4 text-center font-heading text-lg font-bold ${
                state.myResult?.correct
                  ? 'bg-success/15 text-success'
                  : 'bg-danger/10 text-danger'
              }`}
              role="status"
            >
              {state.myResult?.correct
                ? `Correct! +${state.myResult.pointsEarned}`
                : 'Not this time'}
            </div>
            <div className="flex flex-col gap-3">
              {q.options.map((o, i) => {
                const isCorrect = o.id === state.reveal?.correctOptionId;
                const pct = (() => {
                  const dist = state.reveal?.distribution || {};
                  const total = Object.values(dist).reduce((s, n) => s + n, 0);
                  return total ? Math.round(((dist[o.id] || 0) / total) * 100) : 0;
                })();
                return (
                  <QuizOptionTile
                    key={o.id}
                    index={i}
                    text={o.text}
                    disabled
                    percent={pct}
                    status={isCorrect ? 'correct' : selected === o.id ? 'wrong' : 'dim'}
                  />
                );
              })}
            </div>
          </div>
        )}

        {state.phase === 'leaderboard' && (
          <div>
            <h1 className="mb-4 text-center font-heading text-xl font-bold">Leaderboard</h1>
            {state.leaderboard.yourRank && (
              <p className="mb-4 text-center text-sm text-muted">
                You’re #{state.leaderboard.yourRank} with {state.leaderboard.yourScore} pts
              </p>
            )}
            <Leaderboard entries={state.leaderboard.top} highlightNickname={state.me?.nickname} />
          </div>
        )}

        {state.phase === 'finished' && (
          <div>
            <h1 className="mb-5 text-center font-heading text-2xl font-bold">Final results</h1>
            <div className="mb-6">
              <Podium entries={state.finalLeaderboard || []} />
            </div>
            <Leaderboard
              entries={state.finalLeaderboard || []}
              highlightNickname={state.me?.nickname}
            />
            <div className="mt-6 text-center">
              <Link to="/">
                <Button variant="outline">Done</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
