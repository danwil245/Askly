import { useToast } from '../../hooks/useToast.jsx';
import { Icon } from './icons.jsx';

const VARIANT = {
  info: 'border-border bg-surface text-fg',
  success: 'border-success/40 bg-surface text-fg',
  error: 'border-danger/50 bg-surface text-fg',
  warning: 'border-warning/50 bg-surface text-fg',
};

const DOT = {
  info: 'bg-accent',
  success: 'bg-success',
  error: 'bg-danger',
  warning: 'bg-warning',
};

/** Fixed, screen-reader-friendly toast stack. Does not steal focus (aria-live polite). */
export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000] flex flex-col items-center gap-2 p-4 sm:items-end"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border px-4 py-3 shadow-lift ${VARIANT[t.variant] || VARIANT.info}`}
          role={t.variant === 'error' ? 'alert' : 'status'}
        >
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[t.variant] || DOT.info}`} />
          <p className="flex-1 text-sm">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            className="rounded-md p-0.5 text-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Dismiss notification"
          >
            <Icon.X width={16} height={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
