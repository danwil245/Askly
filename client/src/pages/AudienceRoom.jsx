import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom.js';
import { useToast } from '../hooks/useToast.jsx';
import { QuestionForm } from '../components/audience/QuestionForm.jsx';
import { QuestionList } from '../components/audience/QuestionList.jsx';
import { PollVoteCard } from '../components/audience/PollVoteCard.jsx';
import { ConnectionBadge } from '../components/shared/ConnectionBadge.jsx';
import { ThemeToggle } from '../components/shared/ThemeToggle.jsx';
import { Logo } from '../components/shared/Logo.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { RoomNotFound } from './RoomNotFound.jsx';

const friendlyError = (code) => {
  switch (code) {
    case 'RATE_LIMITED':
      return 'You’re going a little fast — try again in a moment.';
    case 'ALREADY_VOTED':
      return 'You’ve already voted in this poll.';
    case 'POLL_CLOSED':
      return 'That poll just closed.';
    case 'ROOM_CLOSED':
      return 'This room has been closed by the host.';
    case 'DUPLICATE_QUESTION':
      return 'Looks like you just asked that.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

export function AudienceRoom() {
  const { code } = useParams();
  const { toast } = useToast();
  const { state, actions } = useRoom(code?.toUpperCase());

  const closed = state.room?.status === 'closed';
  const openPolls = useMemo(() => state.polls.filter((p) => p.status === 'open'), [state.polls]);
  const closedPolls = useMemo(
    () => state.polls.filter((p) => p.status === 'closed'),
    [state.polls]
  );
  const spotlightId = state.room?.spotlightQuestionId;
  const spotlight = useMemo(
    () => (spotlightId ? state.questions.find((q) => q.id === spotlightId) : null),
    [spotlightId, state.questions]
  );

  const guard = async (fn) => {
    try {
      await fn();
    } catch (err) {
      toast(friendlyError(err.code), {
        variant: err.code === 'RATE_LIMITED' ? 'warning' : 'error',
      });
    }
  };

  if (state.fatal?.code === 'ROOM_NOT_FOUND') return <RoomNotFound code={code} />;

  return (
    <div className="min-h-dvh bg-bg pb-40">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Logo showWord={false} />
          </div>
          <h1 className="min-w-0 flex-1 truncate text-center font-heading text-base font-semibold">
            {state.room?.title || 'Loading…'}
          </h1>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 text-xs text-muted sm:inline-flex">
              <Icon.Users width={14} height={14} />
              {state.presence}
            </span>
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 pb-2">
          <ConnectionBadge status={state.connection} />
          <span className="inline-flex items-center gap-1 text-xs text-muted sm:hidden">
            <Icon.Users width={14} height={14} />
            {state.presence} here
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        {closed && (
          <div
            className="mb-4 flex items-center gap-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-fg"
            role="status"
          >
            <Icon.Lock width={16} height={16} className="text-warning" />
            This room is closed. You can still read questions and final poll results.
          </div>
        )}

        {/* Active Quiz Notice */}
        {state.room?.activeQuizCode && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg">
                <Icon.Trophy width={18} height={18} />
              </span>
              <div>
                <p className="font-heading text-sm font-semibold text-fg">Live Quiz is Starting!</p>
                <p className="text-xs text-muted">Game code: {state.room.activeQuizCode}</p>
              </div>
            </div>
            <a
              href={`/play/${state.room.activeQuizCode}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-fg hover:bg-primary-hover shadow-sm"
            >
              Join Quiz
              <Icon.ArrowRight width={14} height={14} />
            </a>
          </div>
        )}

        {/* Spotlighted question ("Now answering") */}
        {spotlight && (
          <div
            className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4"
            role="status"
            aria-live="polite"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg">
              <Icon.Mic width={18} height={18} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Now answering
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words font-heading text-sm font-semibold text-fg">
                {spotlight.text}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {spotlight.authorName && spotlight.authorName !== 'Anonymous'
                  ? `${spotlight.authorName} · `
                  : ''}
                {spotlight.upvoteCount} {spotlight.upvoteCount === 1 ? 'upvote' : 'upvotes'}
              </p>
            </div>
          </div>
        )}

        {/* Active polls */}
        {openPolls.length > 0 && (
          <section className="mb-6 flex flex-col gap-3" aria-label="Active polls">
            {openPolls.map((poll) => (
              <PollVoteCard
                key={poll.id}
                poll={poll}
                myOptionId={state.myVotes[poll.id]}
                disabled={closed}
                onVote={(pollId, optionId) => guard(() => actions.votePoll(pollId, optionId))}
              />
            ))}
          </section>
        )}

        {/* Questions */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted">
            Questions
          </h2>
        </div>
        <QuestionList
          questions={state.questions}
          myUpvotes={state.myUpvotes}
          disabled={closed}
          onUpvote={(id) => guard(() => actions.upvoteQuestion(id))}
          spotlightId={spotlight?.id}
        />

        {/* Closed polls (final results) */}
        {closedPolls.length > 0 && (
          <section className="mt-6 flex flex-col gap-3" aria-label="Closed polls">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted">
              Past polls
            </h2>
            {closedPolls.map((poll) => (
              <PollVoteCard
                key={poll.id}
                poll={poll}
                myOptionId={state.myVotes[poll.id]}
                disabled
              />
            ))}
          </section>
        )}
      </main>

      {/* Sticky composer */}
      {!closed && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/90 backdrop-blur">
          <div
            className="mx-auto max-w-2xl px-4 py-3"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <QuestionForm onSubmit={(text) => guard(() => actions.askQuestion(text))} />
          </div>
        </div>
      )}
    </div>
  );
}
