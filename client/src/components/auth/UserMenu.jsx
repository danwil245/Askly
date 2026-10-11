import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Icon } from '../shared/icons.jsx';

const initials = (name) =>
  (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** Avatar + dropdown with dashboard links and logout. Shown when authenticated. */
export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!user) return null;

  const link = 'block rounded-lg px-3 py-2 text-sm text-fg hover:bg-surface-2';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 hover:bg-surface-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg">
            {initials(user.name)}
          </span>
        )}
        <span className="max-w-[8rem] truncate text-sm font-medium">{user.name}</span>
        <Icon.ChevronDown width={16} height={16} className="text-muted" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-52 animate-slide-up rounded-xl border border-border bg-surface p-1.5 shadow-lift"
          role="menu"
        >
          <p className="truncate px-3 py-1.5 text-xs text-muted">{user.email}</p>
          <div className="my-1 h-px bg-border" />
          <Link to="/speaker" className={link} role="menuitem" onClick={() => setOpen(false)}>
            Speaker rooms
          </Link>
          <Link to="/mentor" className={link} role="menuitem" onClick={() => setOpen(false)}>
            Mentor rooms
          </Link>
          <Link to="/quiz" className={link} role="menuitem" onClick={() => setOpen(false)}>
            Quizzes
          </Link>
          <div className="my-1 h-px bg-border" />
          <button
            className={`${link} w-full text-left text-danger`}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
              navigate('/');
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
