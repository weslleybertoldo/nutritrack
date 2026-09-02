import { describe, it, expect } from "vitest";
import { mergeDuplicateMeals, reconcileMeals } from "./mealsMerge";
import type { Meal, MealItem } from "@/types";

const item = (id: string, meal_id: string, kcal = 100): MealItem =>
  ({ id, meal_id, food_id: "f1", quantidade: 100, calorias_calculadas: kcal, proteina: 1, carbo: 2, gordura: 3 });
const meal = (id: string, tipo: Meal["tipo"], items: MealItem[] = [], data = "2026-09-01"): Meal =>
  ({ id, user_id: "u1", data, tipo, items });

describe("mergeDuplicateMeals", () => {
  it("mantém a lista quando não há duplicata", () => {
    const meals = [meal("a", "cafe_manha", [item("i1", "a")]), meal("b", "almoco")];
    expect(mergeDuplicateMeals(meals)).toEqual(meals);
  });

  it("funde itens de duas refeições do mesmo tipo na primeira (bug do café que 'sumia')", () => {
    const vazia = meal("a", "cafe_manha");
    const comItens = meal("b", "cafe_manha", [item("i1", "b", 200), item("i2", "b", 154)]);
    const out = mergeDuplicateMeals([vazia, comItens, meal("c", "almoco")]);
    expect(out.map(m => m.id)).toEqual(["a", "c"]);
    expect(out[0].items?.map(i => i.id)).toEqual(["i1", "i2"]);
    const kcal = out[0].items!.reduce((s, i) => s + i.calorias_calculadas, 0);
    expect(kcal).toBe(354);
  });

  it("não funde refeições do mesmo tipo em dias diferentes", () => {
    const out = mergeDuplicateMeals([meal("a", "janta", [], "2026-09-01"), meal("b", "janta", [], "2026-09-02")]);
    expect(out).toHaveLength(2);
  });

  it("não altera os objetos originais", () => {
    const a = meal("a", "cafe_manha");
    const b = meal("b", "cafe_manha", [item("i1", "b")]);
    mergeDuplicateMeals([a, b]);
    expect(a.items).toEqual([]);
  });
});

describe("reconcileMeals", () => {
  const date = "2026-09-01";

  it("mantém refeição criada localmente que a resposta atrasada não traz", () => {
    const local = [meal("temp-1", "cafe_manha")];
    const out = reconcileMeals([], local, date, new Set(["temp-1"]), new Set());
    expect(out.map(m => m.id)).toEqual(["temp-1"]);
  });

  it("descarta refeição local que NÃO foi criada nesta sessão (estado velho/cache)", () => {
    const local = [meal("old", "cafe_manha")];
    const out = reconcileMeals([], local, date, new Set(), new Set());
    expect(out).toEqual([]);
  });

  it("mantém item adicionado localmente enquanto o GET estava em voo", () => {
    const server = [meal("a", "almoco", [item("i1", "a")])];
    const local = [meal("a", "almoco", [item("i1", "a"), item("temp-i2", "a")])];
    const out = reconcileMeals(server, local, date, new Set(["temp-i2"]), new Set());
    expect(out[0].items?.map(i => i.id)).toEqual(["i1", "temp-i2"]);
  });

  it("não ressuscita refeição/item removidos localmente", () => {
    const server = [meal("a", "almoco", [item("i1", "a"), item("i2", "a")]), meal("b", "janta")];
    const local = [meal("a", "almoco", [item("i1", "a")])];
    const out = reconcileMeals(server, local, date, new Set(), new Set(["b", "i2"]));
    expect(out.map(m => m.id)).toEqual(["a"]);
    expect(out[0].items?.map(i => i.id)).toEqual(["i1"]);
  });

  it("resposta fresca (servidor já tem tudo) devolve exatamente o servidor", () => {
    const server = [meal("a", "cafe_manha", [item("i1", "a")]), meal("b", "almoco")];
    const local = [meal("a", "cafe_manha", [item("i1", "a")]), meal("b", "almoco")];
    const out = reconcileMeals(server, local, date, new Set(["a", "b", "i1"]), new Set());
    expect(out).toEqual(server);
  });

  it("ignora refeições locais de outra data", () => {
    const local = [meal("x", "janta", [], "2026-08-31")];
    const out = reconcileMeals([], local, date, new Set(["x"]), new Set());
    expect(out).toEqual([]);
  });
});
