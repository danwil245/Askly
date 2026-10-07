const MAP = {
  connected: { label: 'Live', dot: 'bg-success', ring: true, text: 'text-success' },
  connecting: { label: 'Connecting…', dot: 'bg-warning', ring: false, text: 'text-warning' },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-warning', ring: false, text: 'text-warning' },
  idle: { label: 'Offline', dot: 'bg-muted', ring: false, text: 'text-muted' },
  error: { label: 'Disconnected', dot: 'bg-danger', ring: false, text: 'text-danger' },
};

export function ConnectionBadge({ status }) {
  const s = MAP[status] || MAP.idle;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium"
      role="status"
      aria-live="polite"
    >
      <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`}>
        {s.ring && (
          <span className="absolute inset-0 inline-flex h-2 w-2 animate-pulse-ring rounded-full" />
        )}
      </span>
      <span className={s.text}>{s.label}</span>
    </span>
  );
}
