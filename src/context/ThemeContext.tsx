import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Tema } from '@/types';

interface ThemeContextValue {
  tema: Tema;
  setTema: (t: Tema) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ tema: 'system', setTema: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    return (localStorage.getItem('nutritrack-theme') as Tema) || 'system';
  });

  useEffect(() => {
    localStorage.setItem('nutritrack-theme', tema);
    const root = document.documentElement;

    if (tema === 'dark') {
      root.classList.add('dark');
    } else if (tema === 'light') {
      root.classList.remove('dark');
    } else {
      // system
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => {
        if (mq.matches) root.classList.add('dark');
        else root.classList.remove('dark');
      };
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [tema]);

  return (
    <ThemeContext.Provider value={{ tema, setTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
