import { Link } from 'react-router-dom';
import { Logo } from '../components/shared/Logo.jsx';
import { ThemeToggle } from '../components/shared/ThemeToggle.jsx';
import { Button } from '../components/shared/Button.jsx';

/** Temporary placeholder for hub/player routes built in later phases. */
export function ComingSoon({ title = 'Coming soon', note }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" aria-label="Askly home">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex max-w-xl flex-col items-center px-5 py-20 text-center">
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{note || 'This area is being built.'}</p>
        <Link to="/" className="mt-6">
          <Button variant="outline">Back to home</Button>
        </Link>
      </main>
    </div>
  );
}
