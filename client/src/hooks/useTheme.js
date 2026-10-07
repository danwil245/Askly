import { useCallback, useEffect, useState } from 'react';
import { applyTheme, resolveTheme, setTheme as persist } from '../lib/theme.js';

export function useTheme() {
  const [theme, setThemeState] = useState(() => resolveTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setThemeState((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      persist(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
