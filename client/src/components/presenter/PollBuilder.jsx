import { useState } from 'react';
import { Button } from '../shared/Button.jsx';
import { Icon } from '../shared/icons.jsx';

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

/** Builder for creating a poll with 2–6 options (spec section 12). */
export function PollBuilder({ onCreate }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setOption = (i, v) =>
    setOptions((opts) => opts.map((o, idx) => (idx === i ? v.slice(0, 80) : o)));
  const addOption = () => setOptions((opts) => (opts.length < MAX_OPTIONS ? [...opts, ''] : opts));
  const removeOption = (i) =>
    setOptions((opts) => (opts.length > MIN_OPTIONS ? opts.filter((_, idx) => idx !== i) : opts));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!q) return setError('Add a poll question.');
    if (opts.length < MIN_OPTIONS) return setError('Add at least two options.');

    setBusy(true);
    try {
      await onCreate(q, opts);
      setQuestion('');
      setOptions(['', '']);
    } catch (err) {
      setError(err.message || 'Could not create poll.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-4">
      <h3 className="mb-3 font-heading text-base font-semibold">Create a poll</h3>

      <label htmlFor="poll-q" className="mb-1 block text-sm font-medium text-fg">
        Question
      </label>
      <input
        id="poll-q"
        value={question}
        onChange={(e) => setQuestion(e.target.value.slice(0, 140))}
        placeholder="What should we cover next?"
        className="mb-4 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:bg-surface"
      />

      <span className="mb-1 block text-sm font-medium text-fg">Options</span>
      <div className="flex flex-col gap-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:bg-surface"
            />
            {options.length > MIN_OPTIONS && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                aria-label={`Remove option ${i + 1}`}
                className="shrink-0 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-danger"
              >
                <Icon.X width={16} height={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {options.length < MAX_OPTIONS && (
        <Button type="button" variant="ghost" size="sm" onClick={addOption} className="mt-2">
          <Icon.Plus width={16} height={16} />
          Add option
        </Button>
      )}

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4">
        <Button type="submit" loading={busy}>
          <Icon.Poll width={16} height={16} />
          Launch poll
        </Button>
      </div>
    </form>
  );
}
