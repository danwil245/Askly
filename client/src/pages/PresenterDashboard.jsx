import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom.js';
import { useToast } from '../hooks/useToast.jsx';
import { api } from '../api/http.js';
import { getHostToken } from '../lib/hostToken.js';
import { JoinCodeCard } from '../components/presenter/JoinCodeCard.jsx';
import { QuestionModerationList } from '../components/presenter/QuestionModerationList.jsx';
import { PollBuilder } from '../components/presenter/PollBuilder.jsx';
import { PollResultsCard } from '../components/presenter/PollResultsCard.jsx';
import { AnalyticsPanel } from '../components/presenter/AnalyticsPanel.jsx';
import { ConnectionBadge } from '../components/shared/ConnectionBadge.jsx';
import { ThemeToggle } from '../components/shared/ThemeToggle.jsx';
import { Logo } from '../components/shared/Logo.jsx';
import { Button } from '../components/shared/Button.jsx';
import { ConfirmModal } from '../components/shared/Modal.jsx';
import { EmptyState } from '../components/shared/EmptyState.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { RoomNotFound } from './RoomNotFound.jsx';

const TABS = [
  { id: 'questions', label: 'Questions', icon: Icon.Message },
  { id: 'polls', label: 'Polls', icon: Icon.Poll },
  { id: 'analytics', label: 'Analytics', icon: Icon.Chart },
];

export function PresenterDashboard() {
  const { code: rawCode } = useParams();
  const code = rawCode?.toUpperCase();
  const navigate = useNavigate();
  const { toast } = useToast();

  const hostToken = getHostToken(code);
  // No valid host token stored for this code → fall back to the audience view.
  useEffect(() => {
    if (!hostToken) navigate(`/r/${code}`, { replace: true });
  }, [hostToken, code, navigate]);

  const { state, actions } = useRoom(hostToken ? code : undefined, hostToken);
  const [tab, setTab] = useState('questions');
  const [confirmClose, setConfirmClose] = useState(false);
  const [restAnalytics, setRestAnalytics] = useState(null);

  // Seed analytics via REST when the tab opens; socket pushes keep it fresh afterward.
  useEffect(() => {
    if (tab !== 'analytics' || !hostToken) return;
    let cancelled = false;
    api
      .getAnalytics(code, hostToken)
      .then((snap) => !cancelled && setRestAnalytics(snap))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, code, hostToken]);

  // Prefer the live socket snapshot once it arrives.
  const analytics = state.analytics || restAnalytics;

  const closed = state.room?.status === 'closed';
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

  if (!hostToken) return null;
  if (state.fatal?.code === 'ROOM_NOT_FOUND') return <RoomNotFound code={code} />;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Logo showWord={false} />
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-semibold">
                {state.room?.title || 'Loading…'}
              </h1>
              <p className="text-xs text-muted">Presenter dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium">
              <Icon.Users width={14} height={14} className="text-primary" />
              <span className="tabular">{state.presence}</span> live
            </span>
            <ConnectionBadge status={state.connection} />
            <ThemeToggle />
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmClose(true)}
              disabled={closed}
            >
              <Icon.Lock width={14} height={14} />
              {closed ? 'Closed' : 'Close room'}
            </Button>
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
            This room is closed. Writes are disabled for everyone; analytics remain available.
          </div>
        )}

        {/* Tabs */}
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
                  active
                    ? 'bg-primary text-primary-fg'
                    : 'text-muted hover:bg-surface-2 hover:text-fg'
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
              onAnswer={(id, answered) => run(() => actions.answerQuestion(id, answered))}
              onHide={(id, hidden) => run(() => actions.hideQuestion(id, hidden))}
            />
          )}

          {tab === 'polls' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                {!closed ? (
                  <PollBuilder onCreate={actions.createPoll} />
                ) : (
                  <EmptyState icon={Icon.Lock} title="Room closed">
                    You can’t create new polls in a closed room.
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

          {tab === 'analytics' && <AnalyticsPanel analytics={analytics} />}
        </div>
      </main>

      <ConfirmModal
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          run(() => actions.closeRoom(), 'Room closed');
        }}
        title="Close this room?"
        message="Closing the room stops all new questions, votes, and polls. Everyone keeps read access to final results. This can’t be undone."
        confirmLabel="Close room"
      />
    </div>
  );
}
