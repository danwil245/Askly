// Light/dark theme with system default and manual override. Persisted under askly.theme.
const KEY = 'askly.theme';

export function getStoredTheme() {
  try {
    return localStorage.getItem(KEY); // 'light' | 'dark' | null
  } catch {
    return null;
  }
}

export function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function resolveTheme() {
  return getStoredTheme() || (systemPrefersDark() ? 'dark' : 'light');
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
}
