import { Meal, TipoRefeicao, TIPO_REFEICAO_LABELS } from '@/types';

/** Totais de macros (g) e calorias de uma refeição ou grupo de refeições. */
export interface MacroTotals {
  calorias: number;
  proteina: number;
  carbo: number;
  gordura: number;
}

/** % de cada macro dentro da refeição (soma 100 quando há consumo). */
export interface MacroSplit {
  proteina: number;
  carbo: number;
  gordura: number;
}

export interface MealComposition {
  /** Chave estável (tipo da refeição). */
  key: string;
  label: string;
  totals: MacroTotals;
  pct: MacroSplit;
  /** Quantidade de alimentos somados. */
  itemCount: number;
  /** Semana: em quantos dias essa refeição teve registro. */
  days?: number;
}

const KCAL_POR_G = { proteina: 4, carbo: 4, gordura: 9 } as const;

export const EMPTY_TOTALS: MacroTotals = { calorias: 0, proteina: 0, carbo: 0, gordura: 0 };

export function mealLabel(tipo: string, nomePersonalizado?: string | null): string {
  return nomePersonalizado || TIPO_REFEICAO_LABELS[tipo as TipoRefeicao] || tipo;
}

/**
 * Divide 100% entre os macros pela energia (P 4 kcal/g, C 4, G 9).
 * Ex.: só proteína → 100/0/0; 10g/10g/10g → 25/25/50. Arredondamento pelo
 * método do maior resto, então a soma é sempre 100 (ou 0 sem consumo).
 */
export function macroSplit(t: MacroTotals): MacroSplit {
  const kcal = {
    proteina: Math.max(0, t.proteina) * KCAL_POR_G.proteina,
    carbo: Math.max(0, t.carbo) * KCAL_POR_G.carbo,
    gordura: Math.max(0, t.gordura) * KCAL_POR_G.gordura,
  };
  const total = kcal.proteina + kcal.carbo + kcal.gordura;
  if (total <= 0) return { proteina: 0, carbo: 0, gordura: 0 };

  const keys = ['proteina', 'carbo', 'gordura'] as const;
  const exact = keys.map(k => (kcal[k] / total) * 100);
  const floored = exact.map(Math.floor);
  let resto = 100 - floored.reduce((s, v) => s + v, 0);
  // distribui o resto para quem tem maior parte fracionária
  const ordem = keys
    .map((_, i) => i)
    .sort((a, b) => (exact[b] - floored[b]) - (exact[a] - floored[a]));
  for (const i of ordem) {
    if (resto <= 0) break;
    floored[i] += 1;
    resto -= 1;
  }
  return { proteina: floored[0], carbo: floored[1], gordura: floored[2] };
}

interface ItemLike {
  calorias_calculadas: number;
  proteina: number;
  carbo: number;
  gordura: number;
}

export function sumItems(items: ItemLike[]): MacroTotals {
  return items.reduce<MacroTotals>((acc, i) => ({
    calorias: acc.calorias + (Number(i.calorias_calculadas) || 0),
    proteina: acc.proteina + (Number(i.proteina) || 0),
    carbo: acc.carbo + (Number(i.carbo) || 0),
    gordura: acc.gordura + (Number(i.gordura) || 0),
  }), { ...EMPTY_TOTALS });
}

/**
 * Composição de cada refeição do DIA, na ordem recebida. Refeições sem
 * alimento ficam de fora (não há o que compor).
 */
export function composeMealsForDay(meals: Meal[]): MealComposition[] {
  return meals
    .filter(m => (m.items || []).length > 0)
    .map(m => {
      const totals = sumItems(m.items || []);
      return {
        key: m.tipo + (m.nome_personalizado ? `:${m.nome_personalizado}` : ''),
        label: mealLabel(m.tipo, m.nome_personalizado),
        totals,
        pct: macroSplit(totals),
        itemCount: (m.items || []).length,
      };
    });
}

interface WeekMealRow { id: string; data: string; tipo: string; nome_personalizado?: string | null }
interface WeekItemRow extends ItemLike { meal_id: string }

/**
 * Composição por TIPO de refeição ao longo da semana: soma os itens de todas
 * as refeições do mesmo tipo (ex.: todos os cafés da manhã) e conta em
 * quantos dias houve registro. Ordem: `ordemTipos` (config do usuário) e, no
 * fim, tipos fora dela por ordem de aparição.
 */
export function composeMealsForWeek(
  meals: WeekMealRow[],
  items: WeekItemRow[],
  ordemTipos: string[] = [],
): MealComposition[] {
  const byId = new Map(meals.map(m => [m.id, m]));
  const grupos = new Map<string, { label: string; items: ItemLike[]; dias: Set<string> }>();
  const keyOf = (m: WeekMealRow) => m.tipo + (m.nome_personalizado ? `:${m.nome_personalizado}` : '');

  for (const item of items) {
    const meal = byId.get(item.meal_id);
    if (!meal) continue;
    const key = keyOf(meal);
    let g = grupos.get(key);
    if (!g) {
      g = { label: mealLabel(meal.tipo, meal.nome_personalizado), items: [], dias: new Set() };
      grupos.set(key, g);
    }
    g.items.push(item);
    g.dias.add(meal.data);
  }

  const idx = (key: string) => {
    const tipo = key.split(':')[0];
    const i = ordemTipos.indexOf(tipo);
    return i === -1 ? 999 : i;
  };

  return [...grupos.entries()]
    .sort(([a], [b]) => idx(a) - idx(b))
    .map(([key, g]) => {
      const totals = sumItems(g.items);
      return { key, label: g.label, totals, pct: macroSplit(totals), itemCount: g.items.length, days: g.dias.size };
    });
}
