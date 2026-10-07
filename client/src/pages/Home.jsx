import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/http.js';
import { saveHostToken } from '../lib/hostToken.js';
import { Button } from '../components/shared/Button.jsx';
import { Logo } from '../components/shared/Logo.jsx';
import { ThemeToggle } from '../components/shared/ThemeToggle.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { useToast } from '../hooks/useToast.jsx';

export function Home() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const createRoom = async (e) => {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const { code: newCode, hostToken } = await api.createRoom(title.trim());
      saveHostToken(newCode, hostToken); // persist the one-time token
      navigate(`/host/${newCode}`);
    } catch (err) {
      toast(err.message || 'Could not create room', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length !== 6 || joining) return;
    setJoining(true);
    try {
      await api.getRoom(c); // validate the code exists
      navigate(`/r/${c}`);
    } catch (err) {
      toast(err.code === 'ROOM_NOT_FOUND' ? 'No room with that code' : err.message, {
        variant: 'error',
      });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        <section className="py-10 text-center sm:py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Real-time · no accounts needed
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl font-heading text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            Live Q&amp;A and polls that keep your audience in the room
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted">
            Spin up a room, share a code, and watch questions, upvotes, and poll results update
            instantly on every screen.
          </p>
        </section>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Create */}
          <form onSubmit={createRoom} className="card flex flex-col p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon.Spark />
              </span>
              <div>
                <h2 className="font-heading text-lg font-semibold">Create a room</h2>
                <p className="text-sm text-muted">You present — the audience joins.</p>
              </div>
            </div>
            <label htmlFor="room-title" className="mb-1 text-sm font-medium text-fg">
              Room title
            </label>
            <input
              id="room-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder="e.g. Q3 All-Hands"
              className="mb-4 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:bg-surface"
            />
            <Button type="submit" size="lg" loading={creating} disabled={!title.trim()}>
              Create room
            </Button>
          </form>

          {/* Join */}
          <form onSubmit={joinRoom} className="card flex flex-col p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Icon.Users />
              </span>
              <div>
                <h2 className="font-heading text-lg font-semibold">Join a room</h2>
                <p className="text-sm text-muted">Got a 6-character code?</p>
              </div>
            </div>
            <label htmlFor="join-code" className="mb-1 text-sm font-medium text-fg">
              Join code
            </label>
            <input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="mb-4 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-center font-mono text-2xl font-bold tracking-[0.3em] text-fg placeholder:text-muted/50 focus:bg-surface"
            />
            <Button
              type="submit"
              size="lg"
              variant="accent"
              loading={joining}
              disabled={code.trim().length !== 6}
            >
              Join room
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
