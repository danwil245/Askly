import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * A large, keyboard-accessible mode card on the landing page. Navigates to its hub when
 * logged in, otherwise to /login?next=<hub> (spec section 11.2 / 10.7).
 */
export function OptionCard({ icon: IconCmp, title, description, to, accent = 'primary' }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const go = () => {
    if (isAuthenticated) navigate(to);
    else navigate(`/login?next=${encodeURIComponent(to)}`);
  };

  const ring = {
    primary: 'bg-primary/15 text-primary',
    accent: 'bg-accent/15 text-accent',
    warning: 'bg-warning/15 text-warning',
  }[accent];

  return (
    <button
      onClick={go}
      className="group flex h-full flex-col items-start rounded-2xl border border-border bg-surface p-6 text-left shadow-card transition-transform duration-200 hover:-translate-y-1 hover:shadow-lift focus-visible:-translate-y-1"
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${ring}`}>
        <IconCmp width={24} height={24} />
      </span>
      <h3 className="mt-4 font-heading text-xl font-semibold">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm text-muted">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
        Get started
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12h14m-6-6 6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </svg>
      </span>
    </button>
  );
}
