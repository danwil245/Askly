import { useEffect, useState } from 'react';

/**
 * Display-only countdown. The server decides when time is up; this just visualizes the
 * remaining time using `endsAt` corrected by clock `skew` (serverNow - clientNow).
 */
export function TimerRing({ endsAt, totalMs, skew = 0, size = 72 }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, endsAt - (now + skew));
  const secs = Math.ceil(remaining / 1000);
  const frac = totalMs ? Math.max(0, Math.min(1, remaining / totalMs)) : 0;

  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const low = secs <= 5;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-live="off"
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--border))" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={low ? 'rgb(var(--danger))' : 'rgb(var(--primary))'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 0.2s linear' }}
        />
      </svg>
      <span
        className={`tabular absolute font-heading text-xl font-bold ${low ? 'text-danger' : 'text-fg'}`}
      >
        {secs}
      </span>
    </div>
  );
}
