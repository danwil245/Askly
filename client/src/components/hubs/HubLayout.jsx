import { Link } from 'react-router-dom';
import { Logo } from '../shared/Logo.jsx';
import { ThemeToggle } from '../shared/ThemeToggle.jsx';
import { UserMenu } from '../auth/UserMenu.jsx';

/** Shared chrome for the Speaker / Mentor / Quiz hubs. */
export function HubLayout({ title, subtitle, action, children }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link to="/" aria-label="Askly home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </main>
    </div>
  );
}
