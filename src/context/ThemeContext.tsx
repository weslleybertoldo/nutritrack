import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { Tema } from '@/types';

interface ThemeContextValue {
  tema: Tema;
  setTema: (t: Tema) => void;
}

// O app é SÓ escuro (identidade visual do PhysiqCalc). O contexto continua
// existindo pra não quebrar quem consome `useTheme`, mas o tema é fixo.
const ThemeContext = createContext<ThemeContextValue>({ tema: 'dark', setTema: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    try { localStorage.setItem('nutritrack-theme', 'dark'); } catch { /* sem storage */ }
  }, []);

  return (
    <ThemeContext.Provider value={{ tema: 'dark', setTema: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
