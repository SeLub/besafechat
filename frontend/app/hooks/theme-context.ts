import { createContext } from 'react';

type Theme = 'besafe' | 'telegram' | 'minimal';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export type { Theme, ThemeContextType };