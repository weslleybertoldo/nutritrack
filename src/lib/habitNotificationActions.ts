import { formatDate } from '@/lib/calculations';
import type { HabitNotificationExtra } from '@/lib/habitReminders';

/**
 * Evento disparado na janela quando um hábito é marcado como concluído FORA do
 * card (ex.: botão "Sim" na notificação). O HabitosCard ouve e atualiza o chip
 * sem precisar recarregar.
 */
export const HABITO_CONCLUIDO_EVENT = 'nutritrack:habito-concluido';

export interface HabitoConcluidoDetail {
  habitoId: string;
  data: string; // "YYYY-MM-DD"
}

export interface RegistroRow {
  user_id: string;
  habito_id: string;
  data: string;
}

export interface CompleteHabitDeps {
  /** Insere a linha em `habitos_registro`; devolve o erro do PostgREST (ou null). */
  insertRegistro: (row: RegistroRow) => Promise<{ error: { code?: string; message: string } | null }>;
  /** Relógio injetável (testes). */
  now?: () => Date;
}

export type CompleteHabitResult =
  | { ok: true; data: string; jaEstava: boolean }
  | { ok: false; message: string };

/**
 * Marca o hábito como concluído HOJE (data local do toque) a partir da ação
 * "Sim" da notificação. Mesma regra do toggle do card: 23505 (já marcado, ex.
 * por outro aparelho) conta como sucesso.
 */
export async function completeHabitFromNotification(
  userId: string,
  extra: HabitNotificationExtra,
  deps: CompleteHabitDeps,
): Promise<CompleteHabitResult> {
  const data = formatDate((deps.now ?? (() => new Date()))());
  const { error } = await deps.insertRegistro({
    user_id: userId,
    habito_id: extra.habitoId,
    data,
  });
  if (error && error.code !== '23505') return { ok: false, message: error.message };
  return { ok: true, data, jaEstava: error?.code === '23505' };
}

export function emitHabitoConcluido(detail: HabitoConcluidoDetail) {
  window.dispatchEvent(new CustomEvent<HabitoConcluidoDetail>(HABITO_CONCLUIDO_EVENT, { detail }));
}
