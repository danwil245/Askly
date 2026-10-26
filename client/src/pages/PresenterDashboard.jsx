import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom.js';
import { useToast } from '../hooks/useToast.jsx';
import { api } from '../api/http.js';
import { JoinCodeCard } from '../components/presenter/JoinCodeCard.jsx';
import { QuestionModerationList } from '../components/presenter/QuestionModerationList.jsx';
import { PollBuilder } from '../components/presenter/PollBuilder.jsx';
import { PollResultsCard } from '../components/presenter/PollResultsCard.jsx';
import { AnalyticsPanel } from '../components/presenter/AnalyticsPanel.jsx';
import { CloseRoomDialog } from '../components/lifecycle/CloseRoomDialog.jsx';
import { ConnectionBadge } from '../components/shared/ConnectionBadge.jsx';
import { ThemeToggle } from '../components/shared/ThemeToggle.jsx';
import { Logo } from '../components/shared/Logo.jsx';
import { Button } from '../components/shared/Button.jsx';
import { EmptyState } from '../components/shared/EmptyState.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { RoomQuizPanel } from '../components/presenter/RoomQuizPanel.jsx';
import { RoomNotFound } from './RoomNotFound.jsx';

const TABS = [
  { id: 'questions', label: 'Questions', icon: Icon.Message },
  { id: 'polls', label: 'Polls', icon: Icon.Poll },
  { id: 'quiz', label: 'Quiz', icon: Icon.Trophy },
  { id: 'analytics', label: 'Analytics', icon: Icon.Chart },
];

export function PresenterDashboard() {
  const { code: rawCode } = useParams();
  const code = rawCode?.toUpperCase();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { state, actions } = useRoom(code);
  const [tab, setTab] = useState('questions');
  const [showClose, setShowClose] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  const closed = state.room?.status === 'closed';

  // Non-owners are redirected to the audience view once state resolves.
  useEffect(() => {
    if (state.connection === 'connected' && state.room && !state.isHost) {
      navigate(`/r/${code}`, { replace: true });
    }
  }, [state.connection, state.room, state.isHost, code, navigate]);

  // Seed analytics (room-wide) when the tab opens; socket pushes keep it fresh.
  useEffect(() => {
    if (tab !== 'analytics') return undefined;
    let cancelled = false;
    api
      .getAnalytics(code)
      .then((snap) => !cancelled && setAnalytics(snap))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, code]);
  const liveAnalytics = state.analytics || analytics;

  const currentSession = useMemo(
    () => state.sessions.find((s) => s.id === state.currentSessionId),
    [state.sessions, state.currentSessionId]
  );
  const sortedPolls = useMemo(
    () => [...state.polls].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [state.polls]
  );

  const run = async (fn, successMsg) => {
    try {
      await fn();
      if (successMsg) toast(successMsg, { variant: 'success' });
    } catch (err) {
      toast(err.message || 'Action failed', { variant: 'error' });
    }
  };

  if (state.fatal?.code === 'ROOM_NOT_FOUND') return <RoomNotFound code={code} />;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/speaker" aria-label="Back to hub">
              <Logo showWord={false} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-semibold">
                {state.room?.title || 'Loading…'}
              </h1>
              <p className="text-xs text-muted">
                {currentSession ? currentSession.name : closed ? 'Closed' : 'Presenter dashboard'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium">
              <Icon.Users width={14} height={14} className="text-primary" />
              <span className="tabular">{state.presence}</span> live
            </span>
            <ConnectionBadge status={state.connection} />
            <ThemeToggle />
            <Link to={`/history/${code}`}>
              <Button variant="ghost" size="sm">
                <Icon.Clock width={14} height={14} />
                History
              </Button>
            </Link>
            {closed ? (
              <Button variant="primary" size="sm" onClick={() => run(actions.openRoom, 'Room reopened')}>
                Reopen
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setShowClose(true)}>
                <Icon.Lock width={14} height={14} />
                Close room
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <JoinCodeCard code={code} />

        {closed && (
          <div
            className="mt-4 flex items-center gap-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
            role="status"
          >
            <Icon.Lock width={16} height={16} className="text-warning" />
            This room is closed. Reopen it to start a new session — all previous content stays.
          </div>
        )}

        <div
          className="mt-6 flex gap-1 rounded-xl border border-border bg-surface p-1"
          role="tablist"
          aria-label="Dashboard sections"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-primary text-primary-fg' : 'text-muted hover:bg-surface-2 hover:text-fg'
                }`}
              >
                <t.icon width={16} height={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {tab === 'questions' && (
            <QuestionModerationList
              questions={state.questions}
              sessions={state.sessions}
              currentSessionId={state.currentSessionId}
              onAnswer={(id, answered) => run(() => actions.answerQuestion(id, answered))}
              onHide={(id, hidden) => run(() => actions.hideQuestion(id, hidden))}
              onSpotlight={(id) => run(() => actions.spotlightQuestion(id))}
              spotlightId={state.room?.spotlightQuestionId}
              closed={closed}
            />
          )}

          {tab === 'polls' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                {!closed ? (
                  <PollBuilder onCreate={actions.createPoll} />
                ) : (
                  <EmptyState icon={Icon.Lock} title="Room closed">
                    Reopen the room to create new polls.
                  </EmptyState>
                )}
              </div>
              <div className="flex flex-col gap-4">
                {sortedPolls.length === 0 ? (
                  <EmptyState icon={Icon.Poll} title="No polls yet">
                    Launch a poll and results stream in here live.
                  </EmptyState>
                ) : (
                  sortedPolls.map((poll) => (
                    <PollResultsCard
                      key={poll.id}
                      poll={poll}
                      onClose={(id) => run(() => actions.closePoll(id), 'Poll closed')}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'quiz' && (
            <RoomQuizPanel
              roomCode={code}
              closed={closed}
            />
          )}

          {tab === 'analytics' && <AnalyticsPanel analytics={liveAnalytics} />}
        </div>
      </main>

      <CloseRoomDialog
        open={showClose}
        onClose={() => setShowClose(false)}
        onConfirm={(sessionName) => actions.closeRoom(sessionName)}
      />
    </div>
  );
}
