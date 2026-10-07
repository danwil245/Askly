import { useTheme } from '../../hooks/useTheme.js';
import { Icon } from './icons.jsx';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-fg transition-colors hover:bg-surface-2"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Icon.Sun /> : <Icon.Moon />}
    </button>
  );
}
