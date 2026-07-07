-- Impede hábitos duplicados por usuário (mesmo nome, case-insensitive) entre os ativos.
-- Índice PARCIAL (WHERE ativo) para não conflitar com soft-delete: o usuário pode
-- excluir "Creatina" (ativo=false) e recriar depois sem violar a unicidade.
-- Idempotente: dedupe antes + IF NOT EXISTS. Aplicado em public e staging.

-- ── public ──
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY user_id, lower(nome) ORDER BY ordem, created_at, id
  ) AS rn
  FROM public.habitos
  WHERE ativo
)
UPDATE public.habitos h SET ativo = false
FROM ranked r
WHERE h.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS habitos_user_nome_ativo_unique
  ON public.habitos (user_id, lower(nome))
  WHERE ativo;

-- ── staging ──
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY user_id, lower(nome) ORDER BY ordem, created_at, id
  ) AS rn
  FROM staging.habitos
  WHERE ativo
)
UPDATE staging.habitos h SET ativo = false
FROM ranked r
WHERE h.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS habitos_user_nome_ativo_unique
  ON staging.habitos (user_id, lower(nome))
  WHERE ativo;
