import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

const SESSION_KEY = 'nutritrack_cached_session';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getCachedSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    // Valida campos mínimos (não rejeita por expiração — Supabase faz refresh automático)
    if (!session?.user?.id || !session?.access_token) return null;
    return session;
  } catch {
    return null;
  }
}

function saveCachedSession(session: Session | null) {
  try {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Carrega sessão do cache primeiro (funciona offline)
  const cached = getCachedSession();
  const [session, setSession] = useState<Session | null>(cached);
  const [loading, setLoading] = useState(!cached); // Se já tem cache, não bloqueia

  useEffect(() => {
    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      saveCachedSession(session);
      setLoading(false);
    });

    // Se online, tenta refresh/getSession para validar
    if (navigator.onLine) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        saveCachedSession(session);
        setLoading(false);
      }).catch(() => {
        // Falha de rede — mantém sessão em cache
        setLoading(false);
      });
    } else {
      // Offline — usa sessão do cache, não bloqueia
      setLoading(false);
    }

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    saveCachedSession(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
