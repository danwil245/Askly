import { useState } from 'react';
import { Button } from '../shared/Button.jsx';

export function NicknameForm({ onJoin, roomTitle }) {
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const nick = nickname.trim();
    if (nick.length < 2) return setError('Nickname needs at least 2 characters.');
    setBusy(true);
    setError('');
    try {
      await onJoin(nick);
    } catch (err) {
      setError(err.message || 'Could not join the game.');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      {roomTitle && (
        <p className="mb-2 text-center text-sm text-muted">Joining</p>
      )}
      {roomTitle && (
        <h1 className="mb-6 text-center font-heading text-2xl font-bold">{roomTitle}</h1>
      )}
      <form onSubmit={submit} className="card flex flex-col gap-3 p-5">
        <label htmlFor="nickname" className="text-sm font-medium">
          Pick a nickname
        </label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value.slice(0, 20));
            if (error) setError('');
          }}
          placeholder="e.g. QuizWhiz"
          autoFocus
          className="rounded-xl border border-border bg-surface-2 px-3 py-3 text-center text-lg font-semibold text-fg placeholder:font-normal placeholder:text-muted focus:bg-surface"
        />
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={busy} disabled={nickname.trim().length < 2}>
          Join game
        </Button>
      </form>
    </div>
  );
}
