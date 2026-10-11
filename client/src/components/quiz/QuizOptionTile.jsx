// Four option tiles, each with a LETTER (A–D) and a distinct SHAPE in addition to color,
// so meaning never depends on color alone (spec section 11.3). Min 56px tall.
const LETTERS = ['A', 'B', 'C', 'D'];

const STYLES = [
  { bg: 'bg-teal-600', ring: 'ring-teal-600' },
  { bg: 'bg-indigo-600', ring: 'ring-indigo-600' },
  { bg: 'bg-amber-500', ring: 'ring-amber-500' },
  { bg: 'bg-rose-600', ring: 'ring-rose-600' },
];

function Shape({ i }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true };
  switch (i) {
    case 0:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
    case 1:
      return (
        <svg {...common}>
          <path d="M12 4l8 14H4z" />
        </svg>
      );
    case 2:
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 3l9 9-9 9-9-9z" />
        </svg>
      );
  }
}

/**
 * @param {number} index 0-3
 * @param {'idle'|'selected'|'correct'|'wrong'|'dim'} status
 */
export function QuizOptionTile({ index, text, onClick, disabled, status = 'idle', percent }) {
  const s = STYLES[index % 4];
  const emphasis =
    status === 'correct'
      ? 'ring-4 ring-success'
      : status === 'wrong'
        ? 'ring-4 ring-danger'
        : status === 'selected'
          ? `ring-4 ${s.ring}`
          : '';
  const dim = status === 'dim' ? 'opacity-50' : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={`Option ${LETTERS[index]}: ${text}`}
      className={`relative flex min-h-[56px] w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left text-white transition-transform active:scale-[0.98] disabled:cursor-default ${s.bg} ${emphasis} ${dim}`}
    >
      {percent != null && (
        <span
          className="absolute inset-y-0 left-0 bg-black/20"
          style={{ width: `${percent}%` }}
          aria-hidden
        />
      )}
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 font-heading text-lg font-bold">
        {LETTERS[index]}
      </span>
      <span className="relative shrink-0 opacity-90">
        <Shape i={index} />
      </span>
      <span className="relative flex-1 font-medium">{text}</span>
      {percent != null && (
        <span className="tabular relative text-sm font-semibold">{percent}%</span>
      )}
    </button>
  );
}
