-- Uma refeição por (usuário, dia, tipo).
-- Duplicatas nasciam quando a busca das refeições do dia respondia DEPOIS de o
-- usuário tocar no card: a resposta atrasada sobrescrevia a refeição recém-criada,
-- o card voltava a "Vazio" e o segundo toque criava outra linha. A tela mostrava
-- só a primeira (vazia) e o total do dia somava as duas — os alimentos "sumiam".
-- Mescla: os itens vão pra refeição mais antiga; as demais são apagadas.
-- Idempotente (reexecutar não altera nada). Aplicado em public e staging.

-- ── public ──
WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY user_id, data, tipo ORDER BY created_at, id) AS keep_id
  FROM public.meals
)
UPDATE public.meal_items mi SET meal_id = r.keep_id
FROM ranked r
WHERE mi.meal_id = r.id AND r.id <> r.keep_id;

WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY user_id, data, tipo ORDER BY created_at, id) AS keep_id
  FROM public.meals
)
DELETE FROM public.meals m
USING ranked r
WHERE m.id = r.id AND r.id <> r.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS meals_user_data_tipo_unique
  ON public.meals (user_id, data, tipo);

-- ── staging ──
WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY user_id, data, tipo ORDER BY created_at, id) AS keep_id
  FROM staging.meals
)
UPDATE staging.meal_items mi SET meal_id = r.keep_id
FROM ranked r
WHERE mi.meal_id = r.id AND r.id <> r.keep_id;

WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY user_id, data, tipo ORDER BY created_at, id) AS keep_id
  FROM staging.meals
)
DELETE FROM staging.meals m
USING ranked r
WHERE m.id = r.id AND r.id <> r.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS meals_user_data_tipo_unique
  ON staging.meals (user_id, data, tipo);
