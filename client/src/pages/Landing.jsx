import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/shared/Logo.jsx';
import { ThemeToggle } from '../components/shared/ThemeToggle.jsx';
import { Button } from '../components/shared/Button.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { JoinPill } from '../components/hubs/JoinPill.jsx';
import { OptionCard } from '../components/hubs/OptionCard.jsx';
import { UserMenu } from '../components/auth/UserMenu.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const cardsRef = useRef(null);

  const scrollToCards = () =>
    cardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="min-h-dvh bg-bg">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link to="/" aria-label="Askly home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {loading ? null : isAuthenticated ? (
              <UserMenu />
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Sign up</Button>
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        {/* Join pill */}
        <section className="flex justify-center pt-10 sm:pt-14">
          <div className="w-full max-w-xl">
            <JoinPill />
          </div>
        </section>

        {/* Hero */}
        <section className="py-12 text-center sm:py-16">
          <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold tracking-tight text-fg sm:text-6xl">
            Make every session interactive
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            Live Q&amp;A, polls, quizzes, and reusable class rooms — in real time, on every screen.
            Host a room, share a code, and keep your audience in the room.
          </p>
          <div className="mt-8 flex justify-center">
            <Button size="lg" onClick={scrollToCards}>
              Get started
              <Icon.ChevronDown width={18} height={18} />
            </Button>
          </div>
        </section>

        {/* Option cards */}
        <section ref={cardsRef} className="scroll-mt-20 pb-16">
          <h2 className="mb-6 text-center font-heading text-sm font-semibold uppercase tracking-wide text-muted">
            Choose how you want to engage
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            <OptionCard
              icon={Icon.Mic}
              title="Speaker & Audience"
              description="Live Q&A and polls for talks and all-hands. Upvotes surface the best questions; moderate, run polls, and review analytics."
              to="/speaker"
              accent="primary"
            />
            <OptionCard
              icon={Icon.Trophy}
              title="Quiz Arena"
              description="Kahoot-style live quizzes. Players join with a nickname — no account needed. Flat scoring, live leaderboard, saved results."
              to="/quiz"
              accent="warning"
            />
            <OptionCard
              icon={Icon.Cap}
              title="Mentor Room"
              description="Reusable course rooms organized into chapters. Reopen a room anytime and every past question, poll, and session is still there."
              to="/mentor"
              accent="accent"
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-6 text-sm text-muted sm:flex-row">
          <Logo />
          <p>Real-time audience engagement · no accounts needed to play a quiz</p>
        </div>
      </footer>
    </div>
  );
}
