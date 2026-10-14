import { useEffect, useState } from 'react';
import '../styles/theme.css';

const KEY = 'who2pay-theme';
const themes = ['light', 'dark', 'system'];
const getPreference = () => {
  try { const setting = localStorage.getItem(KEY); return themes.includes(setting) ? setting : 'system'; }
  catch { return 'system'; }
};

export function useTheme() {
  const [theme, setTheme] = useState(getPreference);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
  );
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => setSystemDark(event.matches);
    setSystemDark(media.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('w2p-dark', resolvedTheme === 'dark');
    document.documentElement.style.colorScheme = resolvedTheme;
    try { localStorage.setItem(KEY, theme); } catch { /* private browsing */ }
  }, [resolvedTheme, theme]);

  return { theme, setTheme, resolvedTheme };
}
