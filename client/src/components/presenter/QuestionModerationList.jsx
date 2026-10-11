import { useMemo, useState } from 'react';
import { EmptyState } from '../shared/EmptyState.jsx';
import { Button } from '../shared/Button.jsx';
import { Icon } from '../shared/icons.jsx';
import { splitQuestions, sortQuestions } from '../../lib/sort.js';

function ModRow({ q, onAnswer, onHide, hiddenSection }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3">
      <div className="flex min-w-[3rem] flex-col items-center rounded-xl bg-surface-2 px-2 py-1.5">
        <Icon.ChevronUp width={16} height={16} className="text-muted" />
        <span className="tabular text-sm font-semibold">{q.upvoteCount}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-fg">{q.text}</p>
        <p className="mt-0.5 text-xs text-muted">{q.authorName}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {q.answered && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
              <Icon.Check width={12} height={12} /> Answered
            </span>
          )}
          {!hiddenSection && (
            <Button variant="ghost" size="sm" onClick={() => onAnswer(q.id, !q.answered)}>
              <Icon.Check width={15} height={15} />
              {q.answered ? 'Unmark' : 'Answer'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onHide(q.id, !q.hidden)}>
            {q.hidden ? <Icon.Eye width={15} height={15} /> : <Icon.EyeOff width={15} height={15} />}
            {q.hidden ? 'Unhide' : 'Hide'}
          </Button>
        </div>
      </div>
    </li>
  );
}

function SessionGroup({ session, questions, onAnswer, onHide, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          {session.name}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
            {questions.length}
          </span>
          {session.status === 'active' && (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">live</span>
          )}
        </span>
        {open ? <Icon.ChevronUp width={16} /> : <Icon.ChevronDown width={16} />}
      </button>
      {open && (
        <ul className="flex flex-col gap-2.5 px-3 pb-3">
          {questions.map((q) => (
            <ModRow key={q.id} q={q} onAnswer={onAnswer} onHide={onHide} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Presenter moderation list. Shows asker names. When the room has multiple sessions,
 * visible questions are grouped under their session (current session first, expanded).
 * Hidden questions are always in a collapsible section.
 */
export function QuestionModerationList({
  questions,
  sessions = [],
  currentSessionId,
  onAnswer,
  onHide,
}) {
  const { visible, hidden } = useMemo(() => splitQuestions(questions), [questions]);
  const [showHidden, setShowHidden] = useState(false);

  const grouped = sessions.length > 1;

  const groups = useMemo(() => {
    if (!grouped) return [];
    const order = [...sessions].sort((a, b) => {
      if (a.id === currentSessionId) return -1;
      if (b.id === currentSessionId) return 1;
      return new Date(b.startedAt) - new Date(a.startedAt);
    });
    return order
      .map((s) => ({
        session: s,
        questions: sortQuestions(visible.filter((q) => q.sessionId === s.id)),
      }))
      .filter((g) => g.questions.length > 0);
  }, [grouped, sessions, currentSessionId, visible]);

  return (
    <div className="flex flex-col gap-3">
      {visible.length === 0 ? (
        <EmptyState icon={Icon.Message} title="No questions yet">
          Questions from your audience appear here in real time.
        </EmptyState>
      ) : grouped ? (
        groups.map((g, i) => (
          <SessionGroup
            key={g.session.id}
            session={g.session}
            questions={g.questions}
            onAnswer={onAnswer}
            onHide={onHide}
            defaultOpen={i === 0}
          />
        ))
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visible.map((q) => (
            <ModRow key={q.id} q={q} onAnswer={onAnswer} onHide={onHide} />
          ))}
        </ul>
      )}

      {hidden.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface-2/50">
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-muted"
            aria-expanded={showHidden}
          >
            <span className="inline-flex items-center gap-2">
              <Icon.EyeOff width={16} height={16} />
              Hidden ({hidden.length})
            </span>
            {showHidden ? <Icon.ChevronUp width={16} /> : <Icon.ChevronDown width={16} />}
          </button>
          {showHidden && (
            <ul className="flex flex-col gap-2.5 px-3 pb-3">
              {hidden.map((q) => (
                <ModRow key={q.id} q={q} onAnswer={onAnswer} onHide={onHide} hiddenSection />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
