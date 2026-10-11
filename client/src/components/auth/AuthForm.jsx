import { useState } from 'react';
import { Button } from '../shared/Button.jsx';

/**
 * Email/password form for login or signup. `mode` is 'login' | 'signup'.
 * Calls `onSubmit({ name?, email, password })` and surfaces thrown errors inline.
 */
export function AuthForm({ mode, onSubmit }) {
  const isSignup = mode === 'signup';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSignup && !name.trim()) return setError('Please enter your name.');
    if (!email.trim()) return setError('Please enter your email.');
    if (password.length < (isSignup ? 8 : 1))
      return setError(isSignup ? 'Password must be at least 8 characters.' : 'Enter your password.');

    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), email: email.trim(), password });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:bg-surface';

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {isSignup && (
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            autoComplete="name"
            className={field}
            placeholder="Ada Lovelace"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          className={field}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            className={`${field} pr-16`}
            placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute inset-y-0 right-2 my-auto h-7 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface hover:text-fg"
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" loading={busy}>
        {isSignup ? 'Create account' : 'Log in'}
      </Button>
    </form>
  );
}
