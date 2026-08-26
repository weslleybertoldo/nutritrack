import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

/** E-mail do administrador (mesmo do trigger `auto_assign_admin` no banco). */
export const ADMIN_EMAIL = 'weslleybertoldo18@gmail.com';

/**
 * Diz se o usuário logado é o administrador: e-mail do Weslley OU papel `admin`
 * em `user_roles` (RLS deixa cada um ler o próprio papel). A UI só usa isso pra
 * MOSTRAR o atalho — quem manda de verdade é a edge `admin-api`, que confere o
 * papel no servidor a cada chamada.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const [hasRole, setHasRole] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setHasRole(false); return; }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .limit(1);
        if (!cancelled) setHasRole(!error && !!data && data.length > 0);
      } catch {
        if (!cancelled) setHasRole(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return user?.email === ADMIN_EMAIL || hasRole;
}
