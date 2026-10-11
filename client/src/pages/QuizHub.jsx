import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/http.js';
import { HubLayout } from '../components/hubs/HubLayout.jsx';
import { Button } from '../components/shared/Button.jsx';
import { EmptyState } from '../components/shared/EmptyState.jsx';
import { ConfirmModal } from '../components/shared/Modal.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { useToast } from '../hooks/useToast.jsx';

export function QuizHub() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState(null);
  const [games, setGames] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [{ quizzes: qz }, { games: gm }] = await Promise.all([api.quizzes(), api.quizGames()]);
      setQuizzes(qz);
      setGames(gm);
    } catch (err) {
      toast(err.message || 'Could not load quizzes', { variant: 'error' });
      setQuizzes([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const host = async (id) => {
    setBusyId(id);
    try {
      const { code } = await api.hostQuiz(id);
      navigate(`/host/quiz/${code}`);
    } catch (err) {
      toast(err.message || 'Could not host quiz', { variant: 'error' });
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    try {
      await api.deleteQuiz(deleting.id);
      toast('Quiz deleted', { variant: 'success' });
      setDeleting(null);
      await load();
    } catch (err) {
      toast(err.message || 'Could not delete', { variant: 'error' });
    }
  };

  const joinGame = (e) => {
    e.preventDefault();
    const c = joinCode.trim().toUpperCase();
    if (c.length === 6) navigate(`/play/${c}`);
  };

  return (
    <HubLayout
      title="Quiz Arena"
      subtitle="Build live quizzes and host Kahoot-style games. Players join with just a nickname."
      action={
        <Button onClick={() => navigate('/quiz/new')}>
          <Icon.Plus width={16} height={16} />
          Create a quiz
        </Button>
      }
    >
      {/* Join a quiz */}
      <form onSubmit={joinGame} className="card mb-6 flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm font-medium">Join a live quiz</span>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="CODE"
          className="w-32 rounded-xl border border-border bg-surface-2 px-3 py-2 text-center font-mono text-lg font-semibold tracking-widest focus:bg-surface"
        />
        <Button type="submit" variant="accent" size="sm" disabled={joinCode.trim().length !== 6}>
          Join
        </Button>
      </form>

      {/* My quizzes */}
      <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-muted">
        My quizzes
      </h2>
      {quizzes === null ? (
        <p className="py-6 text-center text-sm text-muted">Loading…</p>
      ) : quizzes.length === 0 ? (
        <EmptyState icon={Icon.Trophy} title="No quizzes yet">
          Create your first quiz, then host it live for your audience.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {quizzes.map((qz) => (
            <div key={qz.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <h3 className="truncate font-heading text-base font-semibold">{qz.title}</h3>
                <p className="text-xs text-muted">
                  {qz.questionCount} {qz.questionCount === 1 ? 'question' : 'questions'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/quiz/${qz.id}/edit`)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleting(qz)}
                  className="text-danger"
                >
                  Delete
                </Button>
                <Button size="sm" loading={busyId === qz.id} onClick={() => host(qz.id)}>
                  <Icon.Trophy width={15} height={15} />
                  Host live
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past games */}
      {games.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-heading text-sm font-semibold uppercase tracking-wide text-muted">
            Past games
          </h2>
          <div className="flex flex-col gap-2">
            {games.map((g) => (
              <button
                key={g.sessionId}
                onClick={() => navigate(`/history/session/${g.sessionId}`)}
                className="card flex items-center justify-between p-3 text-left hover:bg-surface-2"
              >
                <div>
                  <p className="text-sm font-medium">{g.title}</p>
                  <p className="text-xs text-muted">
                    {g.summary?.players ?? 0} players · top {g.summary?.topScore ?? 0}
                    {g.interrupted && ' · interrupted'}
                  </p>
                </div>
                <Icon.ArrowRight width={16} height={16} className="text-muted" />
              </button>
            ))}
          </div>
        </>
      )}

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete this quiz?"
        message="The quiz will be removed. Past games already played keep their saved results."
        confirmLabel="Delete quiz"
      />
    </HubLayout>
  );
}
