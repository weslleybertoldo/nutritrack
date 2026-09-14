import { describe, it, expect, vi } from 'vitest';
import {
  completeHabitFromNotification,
  emitHabitoConcluido,
  HABITO_CONCLUIDO_EVENT,
  type HabitoConcluidoDetail,
} from './habitNotificationActions';

const extra = { habitoId: '1ee91617-d5e0-4f3e-9e42-cd3998294925', habitoNome: 'Creatina' };
const now = () => new Date(2026, 8, 13, 23, 30); // 13/09/2026 23:30 local

describe('completeHabitFromNotification', () => {
  it('insere o registro de HOJE (data local do toque) para o hábito da notificação', async () => {
    const insertRegistro = vi.fn(async () => ({ error: null }));
    const r = await completeHabitFromNotification('user-1', extra, { insertRegistro, now });
    expect(insertRegistro).toHaveBeenCalledWith({ user_id: 'user-1', habito_id: extra.habitoId, data: '2026-09-13' });
    expect(r).toEqual({ ok: true, data: '2026-09-13', jaEstava: false });
  });

  it('23505 (já marcado, ex. outro aparelho) conta como sucesso', async () => {
    const insertRegistro = vi.fn(async () => ({ error: { code: '23505', message: 'duplicate key' } }));
    const r = await completeHabitFromNotification('user-1', extra, { insertRegistro, now });
    expect(r).toEqual({ ok: true, data: '2026-09-13', jaEstava: true });
  });

  it('outro erro do banco devolve ok=false com a mensagem', async () => {
    const insertRegistro = vi.fn(async () => ({ error: { code: '42501', message: 'permission denied' } }));
    const r = await completeHabitFromNotification('user-1', extra, { insertRegistro, now });
    expect(r).toEqual({ ok: false, message: 'permission denied' });
  });

  it('usa a data local do relógio atual quando `now` não é injetado', async () => {
    const insertRegistro = vi.fn(async () => ({ error: null }));
    const r = await completeHabitFromNotification('user-1', extra, { insertRegistro });
    const d = new Date();
    const esperado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(r).toEqual({ ok: true, data: esperado, jaEstava: false });
  });
});

describe('emitHabitoConcluido', () => {
  it('dispara o evento na janela com habitoId e data (o card ouve e marca o chip)', () => {
    const recebido: HabitoConcluidoDetail[] = [];
    const listener = (e: Event) => recebido.push((e as CustomEvent<HabitoConcluidoDetail>).detail);
    window.addEventListener(HABITO_CONCLUIDO_EVENT, listener);
    emitHabitoConcluido({ habitoId: extra.habitoId, data: '2026-09-13' });
    window.removeEventListener(HABITO_CONCLUIDO_EVENT, listener);
    expect(recebido).toEqual([{ habitoId: extra.habitoId, data: '2026-09-13' }]);
  });
});
