import { describe, it, expect } from 'vitest';
import {
  notificationId,
  findOrphanNotificationIds,
  buildHabitNotification,
  parseHabitDoneAction,
  needsReminderUpgrade,
  HABIT_ACTION_TYPE_ID,
  HABIT_DONE_ACTION_ID,
  REMINDER_SCHEMA_VERSION,
} from './habitReminders';
import type { ActionPerformed } from '@capacitor/local-notifications';

// Reproduz a impl antiga (v1.37): só os 8 primeiros hex do UUID.
const oldNotificationId = (habitoId: string) =>
  (parseInt(habitoId.replace(/-/g, '').slice(0, 8), 16) % 2000000000) + 1;

describe('notificationId', () => {
  it('gera id positivo dentro do range de 32 bits', () => {
    const id = notificationId('1ee91617-d5e0-4f3e-9e42-cd3998294925');
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThan(2_000_000_001);
  });

  it('é estável para o mesmo UUID', () => {
    const uuid = 'a3f1c2d4-1111-2222-3333-444455556666';
    expect(notificationId(uuid)).toBe(notificationId(uuid));
  });

  it('NÃO colide quando UUIDs diferem só após os 8 primeiros hex (regressão)', () => {
    // A impl antiga usava só os 8 primeiros hex → estes dois colidiam,
    // fazendo um lembrete cancelar/sobrescrever o do outro hábito.
    const a = 'aaaaaaaa-1111-2222-3333-444444444444';
    const b = 'aaaaaaaa-9999-8888-7777-666666666666';
    expect(notificationId(a)).not.toBe(notificationId(b));
  });

  it('distribui bem um lote de UUIDs (sem colisão)', () => {
    const ids = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const h = i.toString(16).padStart(12, '0');
      ids.add(notificationId(`00000000-0000-0000-0000-${h}`));
    }
    expect(ids.size).toBe(500);
  });
});

describe('findOrphanNotificationIds', () => {
  it('detecta notificação órfã do esquema de ID antigo (regressão: 2 lembretes do mesmo hábito pós-update)', () => {
    const uuid = '1ee91617-d5e0-4f3e-9e42-cd3998294925';
    const oldId = oldNotificationId(uuid); // ainda pendente no SO desde a v1.37
    const newId = notificationId(uuid);    // agendado pela v1.38+
    expect(oldId).not.toBe(newId);
    // O SO tem os DOIS pendentes → ambos disparam. Só o antigo é órfão.
    expect(findOrphanNotificationIds([oldId, newId], [uuid])).toEqual([oldId]);
  });

  it('não marca como órfão um lembrete ativo atual', () => {
    const uuid = 'a3f1c2d4-1111-2222-3333-444455556666';
    expect(findOrphanNotificationIds([notificationId(uuid)], [uuid])).toEqual([]);
  });

  it('marca como órfão notificação de hábito removido/desativado', () => {
    const removed = notificationId('dead0000-0000-0000-0000-000000000000');
    expect(findOrphanNotificationIds([removed], [])).toEqual([removed]);
  });
});

describe('buildHabitNotification (botão "Sim")', () => {
  const uuid = '1ee91617-d5e0-4f3e-9e42-cd3998294925';
  const at = new Date(2026, 8, 13, 20, 0);

  it('pergunta «Já completou "X" hoje?» e leva o tipo de ação com o botão', () => {
    const n = buildHabitNotification(uuid, 'Creatina', at);
    expect(n.body).toBe('Já completou "Creatina" hoje?');
    expect(n.title).toBe('Lembrete de Hábito');
    expect(n.actionTypeId).toBe(HABIT_ACTION_TYPE_ID);
  });

  it('guarda habitoId e nome no extra (é o que o toque em "Sim" devolve)', () => {
    const n = buildHabitNotification(uuid, 'Creatina', at);
    expect(n.extra).toEqual({ habitoId: uuid, habitoNome: 'Creatina' });
  });

  it('mantém o id estável (FNV-1a), o canal e a repetição diária no horário pedido', () => {
    const n = buildHabitNotification(uuid, 'Creatina', at);
    expect(n.id).toBe(notificationId(uuid));
    expect(n.channelId).toBe('habit_reminders');
    expect(n.schedule).toEqual({ at, every: 'day', allowWhileIdle: true });
  });
});

describe('parseHabitDoneAction', () => {
  const uuid = '1ee91617-d5e0-4f3e-9e42-cd3998294925';
  const acao = (actionId: string, extra?: unknown): ActionPerformed => ({
    actionId,
    notification: { id: notificationId(uuid), extra } as ActionPerformed['notification'],
  });

  it('toque em "Sim" devolve o hábito da notificação', () => {
    expect(parseHabitDoneAction(acao(HABIT_DONE_ACTION_ID, { habitoId: uuid, habitoNome: 'Creatina' })))
      .toEqual({ habitoId: uuid, habitoNome: 'Creatina' });
  });

  it('toque no corpo da notificação (actionId "tap") não marca nada', () => {
    expect(parseHabitDoneAction(acao('tap', { habitoId: uuid, habitoNome: 'Creatina' }))).toBeNull();
  });

  it('notificação de versão antiga (sem extra) não marca nada', () => {
    expect(parseHabitDoneAction(acao(HABIT_DONE_ACTION_ID))).toBeNull();
    expect(parseHabitDoneAction(acao(HABIT_DONE_ACTION_ID, { habitoId: '' }))).toBeNull();
  });

  it('nome ausente vira string vazia (o hook usa "Hábito" como fallback)', () => {
    expect(parseHabitDoneAction(acao(HABIT_DONE_ACTION_ID, { habitoId: uuid })))
      .toEqual({ habitoId: uuid, habitoNome: '' });
  });
});

describe('needsReminderUpgrade', () => {
  it('sem versão gravada (app antigo) → reagenda tudo 1x pra ganhar o botão', () => {
    expect(needsReminderUpgrade(null)).toBe(true);
  });
  it('versão antiga gravada → reagenda', () => {
    expect(needsReminderUpgrade('1')).toBe(true);
  });
  it('versão atual gravada → não reagenda', () => {
    expect(needsReminderUpgrade(REMINDER_SCHEMA_VERSION)).toBe(false);
  });
});
