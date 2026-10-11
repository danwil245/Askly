import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/http.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Icon } from '../shared/icons.jsx';

/**
 * The landing join box. Looks up the room by code and routes by type (spec section 10):
 *  - quiz  → /play/:code (no login)
 *  - qa/mentor → /r/:code if logged in, else /login?next=/r/:code
 */
export function JoinPill() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const meta = await api.getRoom(c);
      if (meta.type === 'quiz') {
        navigate(`/play/${c}`);
      } else if (isAuthenticated) {
        navigate(`/r/${c}`);
      } else {
        navigate(`/login?next=${encodeURIComponent(`/r/${c}`)}`);
      }
    } catch (err) {
      setError(err.code === 'ROOM_NOT_FOUND' ? "We couldn't find that code." : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-full border border-border bg-surface p-2 pl-5 shadow-lift"
      >
        <label htmlFor="join-code" className="shrink-0 text-sm font-medium text-muted">
          Have a code?
        </label>
        <div className="relative flex flex-1 items-center">
          <span className="pointer-events-none absolute left-2 font-mono text-lg text-muted">#</span>
          <input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="Enter code here"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-transparent px-6 py-2 font-mono text-lg font-semibold tracking-[0.2em] text-fg placeholder:font-body placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-muted focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={code.trim().length !== 6 || busy}
          aria-label="Join"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg transition-[filter,transform] hover:brightness-110 active:scale-95 disabled:opacity-40"
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Icon.ArrowRight width={20} height={20} />
          )}
        </button>
      </form>
      <p className="mt-2 px-5 text-xs text-muted">
        {error ? (
          <span className="text-danger" role="alert">
            {error}
          </span>
        ) : (
          'Quiz codes work instantly. Q&A and class room codes need a quick sign-in.'
        )}
      </p>
    </div>
  );
}
