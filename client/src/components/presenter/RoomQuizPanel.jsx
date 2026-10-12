import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/http.js';
import { useToast } from '../../hooks/useToast.jsx';
import { Button } from '../shared/Button.jsx';
import { EmptyState } from '../shared/EmptyState.jsx';
import { Icon } from '../shared/icons.jsx';

export function RoomQuizPanel({ roomCode, closed }) {
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [launchingId, setLaunchingId] = useState(null);
  const [activeGameCode, setActiveGameCode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .quizzes()
      .then((res) => {
        if (!cancelled) setQuizzes(res?.quizzes || []);
      })
      .catch((err) => {
        if (!cancelled) toast(err.message || 'Could not load quizzes', { variant: 'error' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const launchQuiz = async (quizId) => {
    try {
      setLaunchingId(quizId);
      const res = await api.hostQuiz(quizId, { parentRoomCode: roomCode });
      setActiveGameCode(res.code);
      toast('Quiz launched! Students can join using the code.', { variant: 'success' });
      // Open the quiz host dashboard in a new tab so the host keeps the room dashboard open
      window.open(`/host/quiz/${res.code}`, '_blank');
    } catch (err) {
      toast(err.message || 'Failed to launch quiz', { variant: 'error' });
    } finally {
      setLaunchingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Active Game Notice */}
      {activeGameCode && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-fg">
              <Icon.Trophy width={20} height={20} />
            </span>
            <div>
              <p className="font-heading font-semibold text-fg">Active Quiz Game: {activeGameCode}</p>
              <p className="text-xs text-muted">
                Questions asked will be automatically archived in this room’s session history.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/host/quiz/${activeGameCode}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm">
                Open Host Controller
                <Icon.ArrowRight width={14} height={14} />
              </Button>
            </a>
          </div>
        </div>
      )}

      {/* Header with Create action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Course Quizzes</h2>
          <p className="text-xs text-muted">
            Launch a live Kahoot-style quiz in this room. All questions and results are saved to this room’s session history.
          </p>
        </div>
        <Link to="/quiz/new" target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            <Icon.Plus width={16} height={16} />
            Create Quiz
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-muted">Loading quizzes…</div>
      ) : quizzes.length === 0 ? (
        <EmptyState icon={Icon.Trophy} title="No quizzes created yet">
          <p className="mb-4 text-sm text-muted">
            Create your first quiz to run live interactive question rounds with your students.
          </p>
          <Link to="/quiz/new" target="_blank" rel="noreferrer">
            <Button size="sm">
              <Icon.Plus width={16} height={16} />
              Build a Quiz
            </Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="card flex flex-col justify-between p-5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading font-semibold text-fg">{quiz.title}</h3>
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
                    {quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'}
                  </span>
                </div>
                {quiz.description && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted">{quiz.description}</p>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
                <Link
                  to={`/quiz/${quiz.id}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-muted hover:text-fg"
                >
                  Edit quiz
                </Link>
                <Button
                  size="sm"
                  onClick={() => launchQuiz(quiz.id)}
                  disabled={closed || launchingId === quiz.id}
                >
                  <Icon.Trophy width={14} height={14} />
                  {launchingId === quiz.id ? 'Launching…' : 'Launch in Room'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
