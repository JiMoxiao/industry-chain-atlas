import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme === 'light') {
      return savedTheme;
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add('light');
    localStorage.setItem('theme', 'light');
  }, [theme]);

  const toggleTheme = () => {
    setTheme('light');
  };

  return {
    theme: 'light' as Theme,
    toggleTheme,
    isDark: false
  };
} 
