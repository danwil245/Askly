/**
 * Minimal structured logger. Emits one JSON line per event so logs stay
 * greppable and machine-parseable without pulling in a logging dependency.
 */
const emit = (level, event, meta) => {
  if (process.env.NODE_ENV === 'test') return; // keep test output clean
  const line = { level, event, ts: new Date().toISOString(), ...(meta || {}) };

  console[level === 'error' ? 'error' : 'log'](JSON.stringify(line));
};

export const log = {
  info: (event, meta) => emit('info', event, meta),
  warn: (event, meta) => emit('warn', event, meta),
  error: (event, meta) => emit('error', event, meta),
};
