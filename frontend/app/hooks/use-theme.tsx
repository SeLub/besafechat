import React, { useEffect, useState } from 'react';
import { type Theme, ThemeContext } from './theme-context';
import { useProfileSettings } from './use-profile-settings';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useProfileSettings();
  const [theme, setThemeState] = useState<Theme>(settings.ui.theme);

  // Sync theme when settings change from server
  useEffect(() => {
    setThemeState(settings.ui.theme);
    document.documentElement.setAttribute('data-theme', settings.ui.theme);
  }, [settings.ui.theme]);

  // Sync dark mode class when mode changes from server
  useEffect(() => {
    if (settings.ui.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.ui.mode]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);

    // Sync to server asynchronously (don't wait for response)
    updateSettings({
      ui: {
        theme: newTheme,
        language: settings.ui.language,
        mode: settings.ui.mode,
      },
    }).catch((error) => {
      console.error('Failed to save theme preference:', error);
      // Revert UI if save fails
      setThemeState(settings.ui.theme);
      document.documentElement.setAttribute('data-theme', settings.ui.theme);
    });
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
