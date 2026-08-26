import type { Profile } from '@/types';

/**
 * Campos do perfil que o app NUNCA envia no UPDATE: são controlados pelo
 * servidor (ids/timestamps) ou pelo admin (bloqueio/trava). Antes o app
 * mandava o snapshot inteiro do perfil — inclusive esses campos.
 */
export const PROFILE_READONLY_KEYS: ReadonlyArray<string> = [
  'id',
  'user_id',
  'created_at',
  'updated_at',
  'user_code',
  'admin_locked',
  'blocked',
];

/**
 * Monta o PATCH parcial pro Supabase a partir só dos campos que mudaram.
 * - `undefined` vira `null` (limpar um campo tem que chegar no banco — em JSON
 *   `undefined` some e o campo ficava com o valor antigo).
 * - Ignora campos somente-leitura.
 *
 * Enviar só o delta evita que um snapshot velho (outro aparelho, cache offline,
 * fila de sincronização) sobrescreva campos que o usuário alterou depois.
 */
export function buildProfilePatch(p: Partial<Profile>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(p)) {
    if (PROFILE_READONLY_KEYS.includes(key)) continue;
    out[key] = value === undefined ? null : value;
  }
  return out;
}

/** Erro de sessão (JWT expirado/inválido) — vale tentar refresh e repetir 1x. */
export function isAuthError(err: { code?: string; message?: string; status?: number } | null | undefined): boolean {
  if (!err) return false;
  if (err.status === 401) return true;
  if (err.code === 'PGRST301' || err.code === 'PGRST303') return true;
  return /jwt|token|expired|unauthori[sz]ed/i.test(err.message || '');
}
