import { describe, it, expect } from 'vitest';
import { buildProfilePatch, isAuthError, PROFILE_READONLY_KEYS } from './profilePatch';
import { compactQueue, type PendingOperation } from './offlineSync';

describe('buildProfilePatch (fix: ajuste manual da meta não persistia)', () => {
  it('envia só o campo alterado, não o snapshot inteiro', () => {
    expect(buildProfilePatch({ ajuste_calorico: -750 })).toEqual({ ajuste_calorico: -750 });
  });

  it('converte undefined em null pra limpar o campo no banco', () => {
    expect(buildProfilePatch({ peso: undefined })).toEqual({ peso: null });
  });

  it('nunca envia campos controlados pelo servidor/admin', () => {
    const patch = buildProfilePatch({
      id: 'x', user_id: 'u', created_at: 'a', updated_at: 'b', user_code: 1,
      admin_locked: false, blocked: true, nome: 'Weslley',
    } as never);
    expect(patch).toEqual({ nome: 'Weslley' });
    for (const k of PROFILE_READONLY_KEYS) expect(patch).not.toHaveProperty(k);
  });

  it('patch vazio quando só vêm campos somente-leitura', () => {
    expect(buildProfilePatch({ admin_locked: true } as never)).toEqual({});
  });
});

describe('isAuthError', () => {
  it('reconhece JWT expirado / 401 / PGRST301', () => {
    expect(isAuthError({ message: 'JWT expired' })).toBe(true);
    expect(isAuthError({ status: 401, message: '' })).toBe(true);
    expect(isAuthError({ code: 'PGRST301', message: '' })).toBe(true);
  });
  it('não confunde erro de dado com erro de sessão', () => {
    expect(isAuthError({ code: '23514', message: 'violates check constraint' })).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });
});

describe('compactQueue: updates parciais no mesmo registro se acumulam', () => {
  const op = (data: Record<string, unknown>, createdAt: number): PendingOperation => ({
    id: `op-${createdAt}`, table: 'profiles', type: 'update', data, match: { user_id: 'u1' }, createdAt,
  });

  it('mescla os campos em vez de descartar o update anterior', () => {
    const result = compactQueue([op({ ajuste_calorico: -750 }, 1), op({ peso: 83 }, 2)]);
    expect(result).toHaveLength(1);
    expect(result[0].data).toEqual({ ajuste_calorico: -750, peso: 83 });
  });

  it('o valor mais novo do mesmo campo vence', () => {
    const result = compactQueue([op({ ajuste_calorico: -50 }, 1), op({ ajuste_calorico: -750 }, 2)]);
    expect(result[0].data).toEqual({ ajuste_calorico: -750 });
  });

  it('delete depois do update continua prevalecendo', () => {
    const del: PendingOperation = { id: 'd', table: 'profiles', type: 'delete', match: { user_id: 'u1' }, createdAt: 3 };
    const result = compactQueue([op({ peso: 83 }, 1), del]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('delete');
  });
});
