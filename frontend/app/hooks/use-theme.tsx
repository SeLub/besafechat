import React, { useEffect, useState } from 'react';
import { type Theme, ThemeContext } from './theme-context';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('besafe');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored && ['besafe', 'telegram', 'minimal'].includes(stored)) {
      setThemeState(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      document.documentElement.setAttribute('data-theme', 'besafe');
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}


