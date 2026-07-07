import { describe, it, expect } from 'vitest';
import { notificationId } from './habitReminders';

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
