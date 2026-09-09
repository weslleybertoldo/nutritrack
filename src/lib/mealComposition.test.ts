import { describe, it, expect } from 'vitest';
import { macroSplit, composeMealsForDay, composeMealsForWeek, sumItems } from './mealComposition';
import type { Meal } from '@/types';

const item = (p: number, c: number, g: number, kcal = p * 4 + c * 4 + g * 9) => ({
  id: crypto.randomUUID(), meal_id: 'm', food_id: 'f', quantidade: 100,
  calorias_calculadas: kcal, proteina: p, carbo: c, gordura: g,
});

describe('macroSplit', () => {
  it('só proteína = 100% proteína', () => {
    expect(macroSplit({ calorias: 120, proteina: 30, carbo: 0, gordura: 0 })).toEqual({ proteina: 100, carbo: 0, gordura: 0 });
  });

  it('divide pela energia (4/4/9): 45g P + 45g C + 40g G = 25/25/50', () => {
    // 180 + 180 + 360 = 720 kcal
    expect(macroSplit({ calorias: 720, proteina: 45, carbo: 45, gordura: 40 })).toEqual({ proteina: 25, carbo: 25, gordura: 50 });
  });

  it('10g de cada macro: gordura pesa mais (9 kcal/g) → 24/23/53', () => {
    expect(macroSplit({ calorias: 170, proteina: 10, carbo: 10, gordura: 10 })).toEqual({ proteina: 24, carbo: 23, gordura: 53 });
  });

  it('sem consumo = 0/0/0', () => {
    expect(macroSplit({ calorias: 0, proteina: 0, carbo: 0, gordura: 0 })).toEqual({ proteina: 0, carbo: 0, gordura: 0 });
  });

  it('arredondamento sempre soma 100', () => {
    for (const [p, c, g] of [[1, 1, 1], [33, 33, 1], [7, 11, 3], [50, 1, 0], [0.4, 0.3, 0.3]]) {
      const s = macroSplit({ calorias: 0, proteina: p, carbo: c, gordura: g });
      expect(s.proteina + s.carbo + s.gordura).toBe(100);
    }
  });

  it('ignora valores negativos/inválidos', () => {
    expect(macroSplit({ calorias: 0, proteina: -5, carbo: 10, gordura: 0 })).toEqual({ proteina: 0, carbo: 100, gordura: 0 });
  });
});

describe('composeMealsForDay', () => {
  const meals: Meal[] = [
    { id: '1', user_id: 'u', data: '2026-09-08', tipo: 'cafe_manha', items: [item(20, 0, 0), item(10, 30, 5)] },
    { id: '2', user_id: 'u', data: '2026-09-08', tipo: 'almoco', items: [] },
    { id: '3', user_id: 'u', data: '2026-09-08', tipo: 'personalizado', nome_personalizado: 'Pré-treino', items: [item(0, 50, 0)] },
  ];

  it('soma os itens por refeição e calcula o % de cada macro', () => {
    const r = composeMealsForDay(meals);
    expect(r.map(x => x.label)).toEqual(['Café da Manhã', 'Pré-treino']);
    expect(r[0].totals).toEqual({ calorias: 80 + 205, proteina: 30, carbo: 30, gordura: 5 });
    expect(r[0].itemCount).toBe(2);
    // 120 + 120 + 45 = 285 kcal → 42/42/16
    expect(r[0].pct).toEqual({ proteina: 42, carbo: 42, gordura: 16 });
    expect(r[1].pct).toEqual({ proteina: 0, carbo: 100, gordura: 0 });
  });

  it('refeição vazia fica de fora', () => {
    expect(composeMealsForDay(meals).some(x => x.label === 'Almoço')).toBe(false);
  });
});

describe('composeMealsForWeek', () => {
  const mealsRows = [
    { id: 'a', data: '2026-09-02', tipo: 'cafe_manha' },
    { id: 'b', data: '2026-09-03', tipo: 'cafe_manha' },
    { id: 'c', data: '2026-09-03', tipo: 'almoco' },
    { id: 'd', data: '2026-09-04', tipo: 'personalizado', nome_personalizado: 'Whey pós treino' },
  ];
  const items = [
    { ...item(20, 20, 0), meal_id: 'a' },
    { ...item(10, 0, 10), meal_id: 'b' },
    { ...item(40, 60, 10), meal_id: 'c' },
    { ...item(30, 5, 2), meal_id: 'd' },
    { ...item(99, 99, 99), meal_id: 'zzz' }, // refeição fora da semana: ignorada
  ];

  it('agrupa por tipo, soma e conta dias', () => {
    const r = composeMealsForWeek(mealsRows, items, ['cafe_manha', 'almoco']);
    expect(r.map(x => x.label)).toEqual(['Café da Manhã', 'Almoço', 'Whey pós treino']);
    expect(r[0].totals).toEqual({ calorias: 160 + 130, proteina: 30, carbo: 20, gordura: 10 });
    expect(r[0].days).toBe(2);
    expect(r[0].itemCount).toBe(2);
    expect(r[1].days).toBe(1);
    expect(r[2].label).toBe('Whey pós treino');
    expect(r[2].pct.proteina + r[2].pct.carbo + r[2].pct.gordura).toBe(100);
  });

  it('sem itens devolve lista vazia', () => {
    expect(composeMealsForWeek(mealsRows, [])).toEqual([]);
  });
});

describe('sumItems', () => {
  it('tolera valores nulos', () => {
    expect(sumItems([{ calorias_calculadas: NaN as number, proteina: 1, carbo: 2, gordura: 3 }])).toEqual({ calorias: 0, proteina: 1, carbo: 2, gordura: 3 });
  });
});
