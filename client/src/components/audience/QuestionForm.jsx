import { useState } from 'react';
import { Button } from '../shared/Button.jsx';
import { Icon } from '../shared/icons.jsx';

const MAX = 280;

/** Sticky question composer with a live character counter (spec section 12). */
export function QuestionForm({ onSubmit, disabled }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const remaining = MAX - text.length;
  const near = remaining <= 20;

  const submit = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy || disabled) return;
    setBusy(true);
    try {
      await onSubmit(value);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-3">
      <label htmlFor="q-input" className="sr-only">
        Ask a question
      </label>
      <textarea
        id="q-input"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        placeholder="Ask a question…"
        rows={2}
        disabled={disabled}
        className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-base text-fg placeholder:text-muted focus:bg-surface disabled:opacity-60"
      />
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`tabular text-xs ${near ? 'text-warning' : 'text-muted'}`}
          aria-live="polite"
        >
          {remaining} left
        </span>
        <Button type="submit" size="sm" loading={busy} disabled={!text.trim() || disabled}>
          <Icon.Spark width={16} height={16} />
          Ask
        </Button>
      </div>
    </form>
  );
}
