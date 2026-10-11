import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/http.js';
import { Logo } from '../components/shared/Logo.jsx';
import { ThemeToggle } from '../components/shared/ThemeToggle.jsx';
import { Button } from '../components/shared/Button.jsx';

/** Join-a-quiz form (code first). Anonymous players reach /play/:code directly. */
export function PlayJoin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length !== 6) return;
    setBusy(true);
    setError('');
    try {
      const meta = await api.getRoom(c);
      if (meta.type !== 'quiz') {
        setError('That code is not a quiz.');
        return;
      }
      navigate(`/play/${c}`);
    } catch (err) {
      setError(err.code === 'ROOM_NOT_FOUND' ? "We couldn't find that code." : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/" aria-label="Askly home">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-heading text-2xl font-bold">Join a quiz</h1>
          <p className="mt-1 text-sm text-muted">Enter the game code from the host’s screen.</p>
          <form onSubmit={submit} className="card mt-6 flex flex-col gap-3 p-5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="CODE"
              autoFocus
              className="rounded-xl border border-border bg-surface-2 px-3 py-3 text-center font-mono text-2xl font-bold tracking-[0.3em] focus:bg-surface"
            />
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={busy} disabled={code.trim().length !== 6}>
              Continue
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
