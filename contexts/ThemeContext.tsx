import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'iphonerepasse-theme';
const LIGHT_THEME_COLOR = '#f5f7fb';
const DARK_THEME_COLOR = '#0b1220';

const syncBrowserBrand = (theme: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;

  const favicon = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (favicon) {
    favicon.href = theme === 'dark' ? '/brand/favicon-dark-32.png' : '/brand/favicon-32.png';
  }

  const themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }

  const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
  if (statusBarMeta) {
    statusBarMeta.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system';
    }
    return 'system';
  });
  
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const root = window.document.documentElement;
    
    const getSystemTheme = () => {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const updateTheme = () => {
      let newTheme: 'light' | 'dark';
      
      if (theme === 'system') {
        newTheme = getSystemTheme();
      } else {
        newTheme = theme;
      }
      
      setResolvedTheme(newTheme);
      syncBrowserBrand(newTheme);
      
      if (newTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    updateTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        updateTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
