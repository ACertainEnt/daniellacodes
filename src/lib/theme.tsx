import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'dc-theme';
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} });

const initial = (): Theme => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage blocked */ }
  return 'light'; // light mode is the default, per the brief
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* storage blocked */ }
    const meta = document.querySelector('meta[name="theme-color"]:not([media])') || document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', theme === 'dark' ? '#101814' : '#F8FAF5');
    if (!meta.parentElement) document.head.appendChild(meta);
  }, [theme]);
  return <Ctx.Provider value={{ theme, toggle: () => setTheme(t => t === 'light' ? 'dark' : 'light') }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
