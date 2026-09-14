import { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  parseHabitDoneAction,
  registerHabitActionTypes,
  onHabitCompleted,
  type HabitNotificationExtra,
} from '@/lib/habitReminders';
import { completeHabitFromNotification, emitHabitoConcluido } from '@/lib/habitNotificationActions';

/**
 * Botão "Sim" da notificação de hábito (Android). Tocar no botão abre o app e o
 * plugin entrega `localNotificationActionPerformed` (retido até alguém ouvir —
 * funciona também no boot frio). Aqui marcamos o hábito de hoje, cancelamos o
 * lembrete do dia e avisamos o card. Se a sessão ainda não carregou, a ação
 * fica na fila e roda assim que houver `user`.
 */
export function useHabitNotificationActions() {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const filaRef = useRef<HabitNotificationExtra[]>([]);

  const processar = useCallback(async (extra: HabitNotificationExtra, userId: string) => {
    const nome = extra.habitoNome || 'Hábito';
    try {
      const result = await completeHabitFromNotification(userId, extra, {
        insertRegistro: async (row) => {
          const { error } = await supabase.from('habitos_registro').insert(row);
          return { error };
        },
      });
      if (result.ok === false) {
        console.warn('[HabitNotificationActions] Erro ao marcar hábito:', result.message);
        toast.error(`Não foi possível marcar "${nome}". Marque pelo app.`);
        return;
      }
      emitHabitoConcluido({ habitoId: extra.habitoId, data: result.data });
      // Cancela o lembrete de hoje e joga pra amanhã (mesmo caminho do toggle).
      onHabitCompleted(extra.habitoId, nome).catch(e =>
        console.warn('[HabitNotificationActions] Falha ao reagendar lembrete:', e));
      toast.success(`"${nome}" marcado como concluído!`);
    } catch (e) {
      console.warn('[HabitNotificationActions] Erro inesperado:', e);
      toast.error(`Não foi possível marcar "${nome}". Marque pelo app.`);
    }
  }, []);

  // Listener único da ação (só nativo). Registra o tipo de ação no boot para a
  // notificação já sair com o botão.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    registerHabitActionTypes();
    const handle = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const extra = parseHabitDoneAction(action);
      if (!extra) return; // toque no corpo da notificação: só abre o app
      const u = userRef.current;
      if (u) processar(extra, u.id);
      else filaRef.current.push(extra);
    });
    return () => {
      handle.then(h => h.remove()).catch(e =>
        console.warn('[HabitNotificationActions] erro ao remover listener:', e));
    };
  }, [processar]);

  // Sessão chegou depois do toque (boot frio): esvazia a fila.
  useEffect(() => {
    if (!user || filaRef.current.length === 0) return;
    const fila = filaRef.current;
    filaRef.current = [];
    for (const extra of fila) processar(extra, user.id);
  }, [user, processar]);
}
