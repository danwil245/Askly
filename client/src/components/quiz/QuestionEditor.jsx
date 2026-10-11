import { Button } from '../shared/Button.jsx';
import { Icon } from '../shared/icons.jsx';

const uid = () => crypto.randomUUID();
const LETTERS = ['A', 'B', 'C', 'D'];

/** Editor for a single quiz question. `question` is controlled; changes bubble via onChange. */
export function QuestionEditor({ question, index, total, onChange, onRemove, onMove, onDuplicate }) {
  const set = (patch) => onChange({ ...question, ...patch });

  const setOption = (id, text) =>
    set({ options: question.options.map((o) => (o.id === id ? { ...o, text } : o)) });

  const addOption = () =>
    question.options.length < 4 &&
    set({ options: [...question.options, { id: uid(), text: '' }] });

  const removeOption = (id) => {
    if (question.options.length <= 2) return;
    const options = question.options.filter((o) => o.id !== id);
    const correctOptionId =
      question.correctOptionId === id ? options[0].id : question.correctOptionId;
    set({ options, correctOptionId });
  };

  const field =
    'w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-muted focus:bg-surface';

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-heading text-sm font-semibold text-muted">
          Question {index + 1} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(index, index - 1)}
            disabled={index === 0}
            aria-label="Move up"
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 disabled:opacity-30"
          >
            <Icon.ChevronUp width={16} height={16} />
          </button>
          <button
            onClick={() => onMove(index, index + 1)}
            disabled={index === total - 1}
            aria-label="Move down"
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 disabled:opacity-30"
          >
            <Icon.ChevronDown width={16} height={16} />
          </button>
          <button
            onClick={() => onDuplicate(index)}
            aria-label="Duplicate"
            className="rounded-md p-1.5 text-muted hover:bg-surface-2"
          >
            <Icon.Copy width={16} height={16} />
          </button>
          <button
            onClick={() => onRemove(index)}
            aria-label="Delete question"
            className="rounded-md p-1.5 text-muted hover:bg-danger/15 hover:text-danger"
          >
            <Icon.X width={16} height={16} />
          </button>
        </div>
      </div>

      <input
        value={question.text}
        onChange={(e) => set({ text: e.target.value.slice(0, 200) })}
        placeholder="Type your question"
        className={`${field} mb-3`}
      />

      <p className="mb-1.5 text-xs text-muted">Tap the circle to mark the correct answer.</p>
      <div className="flex flex-col gap-2">
        {question.options.map((o, i) => (
          <div key={o.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => set({ correctOptionId: o.id })}
              aria-label={`Mark option ${LETTERS[i]} correct`}
              aria-pressed={question.correctOptionId === o.id}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                question.correctOptionId === o.id
                  ? 'border-success bg-success text-white'
                  : 'border-border text-muted hover:border-success'
              }`}
            >
              {question.correctOptionId === o.id ? <Icon.Check width={14} height={14} /> : LETTERS[i]}
            </button>
            <input
              value={o.text}
              onChange={(e) => setOption(o.id, e.target.value.slice(0, 100))}
              placeholder={`Option ${LETTERS[i]}`}
              className={field}
            />
            {question.options.length > 2 && (
              <button
                onClick={() => removeOption(o.id)}
                aria-label="Remove option"
                className="rounded-md p-1.5 text-muted hover:text-danger"
              >
                <Icon.X width={15} height={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {question.options.length < 4 ? (
          <Button type="button" variant="ghost" size="sm" onClick={addOption}>
            <Icon.Plus width={15} height={15} />
            Add option
          </Button>
        ) : (
          <span />
        )}
        <label className="flex items-center gap-2 text-xs text-muted">
          <Icon.Clock width={14} height={14} />
          <select
            value={question.timeLimitSec}
            onChange={(e) => set({ timeLimitSec: Number(e.target.value) })}
            className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-fg"
          >
            {[10, 15, 20, 30, 45, 60, 90, 120].map((s) => (
              <option key={s} value={s}>
                {s}s
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export const makeBlankQuestion = () => {
  const options = [
    { id: uid(), text: '' },
    { id: uid(), text: '' },
  ];
  return { id: uid(), text: '', options, correctOptionId: options[0].id, timeLimitSec: 20 };
};
