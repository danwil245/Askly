import { Link } from 'react-router-dom';
import { Logo } from '../shared/Logo.jsx';
import { ThemeToggle } from '../shared/ThemeToggle.jsx';

/** Centered card layout shared by Login and Signup. */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link to="/" aria-label="Askly home">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex max-w-md flex-col px-5 py-6 sm:py-12">
        <div className="card p-6 sm:p-8">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <p className="mt-5 text-center text-sm text-muted">{footer}</p>}
      </main>
    </div>
  );
}
