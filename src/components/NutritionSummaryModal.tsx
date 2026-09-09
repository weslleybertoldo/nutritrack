import React, { useState, useEffect, useMemo } from 'react';
import { Profile, Meal } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/calculations';
import { composeMealsForDay, composeMealsForWeek } from '@/lib/mealComposition';
import { Progress } from '@/components/ui/progress';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Spinner } from '@/components/ui/spinner';
import MealCompositionList from '@/components/MealCompositionList';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';

interface NutritionSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  summary: { calorias: number; proteina: number; carbo: number; gordura: number };
  metaFinal: number;
  macroMetas: { proteina: { g: number }; carbo: { g: number }; gordura: { g: number } };
  profile: Profile;
  userId: string;
  /** Refeições do dia (com itens) — alimenta a sub-aba "Refeições" de Hoje. */
  meals: Meal[];
  /** Ordem dos tipos de refeição configurada pelo usuário. */
  mealOrder?: string[];
}

type Tab = 'hoje' | 'semana';
type SubTab = 'resumo' | 'refeicoes';

interface DaySummary {
  date: string;
  label: string;
  calorias: number;
  proteina: number;
  carbo: number;
  gordura: number;
}

interface WeekMealRow { id: string; data: string; tipo: string; nome_personalizado?: string | null }
interface WeekItemRow { meal_id: string; calorias_calculadas: number; proteina: number; carbo: number; gordura: number }

const DONUT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--warning))',
  'hsl(var(--caution, 30 80% 55%))',
];

const EMPTY_MICROS = { fibras: 0, sodio: 0, acucares: 0, gordura_saturada: 0, colesterol: 0, potassio: 0 };

export default function NutritionSummaryModal({
  open, onOpenChange, selectedDate, summary, metaFinal, macroMetas, profile, userId, meals, mealOrder = [],
}: NutritionSummaryModalProps) {
  const [tab, setTab] = useState<Tab>('hoje');
  const [sub, setSub] = useState<SubTab>('resumo');
  const [weekData, setWeekData] = useState<DaySummary[]>([]);
  const [weekMealRows, setWeekMealRows] = useState<WeekMealRow[]>([]);
  const [weekItems, setWeekItems] = useState<WeekItemRow[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(false);

  // Compute micronutrient totals from meals for today
  const [microTotals, setMicroTotals] = useState({ ...EMPTY_MICROS });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadMicros = async () => {
      try {
        const { data: mealsData, error: mealsError } = await supabase.from('meals').select('id').eq('user_id', userId).eq('data', selectedDate);
        if (cancelled) return;
        if (mealsError) { console.warn('Erro ao carregar micros (meals):', mealsError.message); return; }
        if (!mealsData || mealsData.length === 0) return;
        const mealIds = mealsData.map(m => m.id);
        const { data: items, error: itemsError } = await supabase.from('meal_items').select('quantidade, food:foods(*)').in('meal_id', mealIds);
        if (cancelled) return;
        if (itemsError) { console.warn('Erro ao carregar micros (items):', itemsError.message); return; }
        if (!items) return;

        const totals = { ...EMPTY_MICROS };
        type MealItemRow = { quantidade: number; food: Record<string, number | null> | null };
        (items as unknown as MealItemRow[]).forEach((item) => {
          if (!item.food) return;
          const f = item.quantidade / 100;
          totals.fibras += (Number(item.food.fibras_por_100) || 0) * f;
          totals.sodio += (Number(item.food.sodio_por_100) || 0) * f;
          totals.acucares += (Number(item.food.acucares_por_100) || 0) * f;
          totals.gordura_saturada += (Number(item.food.gordura_saturada_por_100) || 0) * f;
          totals.colesterol += (Number(item.food.colesterol_por_100) || 0) * f;
          totals.potassio += (Number(item.food.potassio_por_100) || 0) * f;
        });
        if (!cancelled) setMicroTotals(totals);
      } catch (e) {
        if (!cancelled) console.error('[NutritionSummary] Erro ao carregar micros:', e);
      }
    };
    loadMicros();
    return () => { cancelled = true; };
  }, [open, userId, selectedDate]);

  // Load week data (totais por dia + refeições/itens pra composição por refeição)
  useEffect(() => {
    if (!open || tab !== 'semana') return;
    let cancelled = false;
    const loadWeek = async () => {
      setLoadingWeek(true);
      try {
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(selectedDate + 'T12:00:00');
          d.setDate(d.getDate() - i);
          dates.push(formatDate(d));
        }
        const emptyWeek = () => dates.map(date => ({
          date, label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3),
          calorias: 0, proteina: 0, carbo: 0, gordura: 0,
        }));

        const { data: mealsData, error: mealsError } = await supabase
          .from('meals').select('id, data, tipo, nome_personalizado').eq('user_id', userId)
          .in('data', dates);
        if (cancelled) return;

        if (mealsError) { console.warn('Erro ao carregar semana (meals):', mealsError.message); return; }
        if (!mealsData || mealsData.length === 0) {
          setWeekData(emptyWeek());
          setWeekMealRows([]);
          setWeekItems([]);
          return;
        }

        const mealIds = mealsData.map(m => m.id);
        const { data: items, error: itemsError } = await supabase
          .from('meal_items').select('meal_id, calorias_calculadas, proteina, carbo, gordura')
          .in('meal_id', mealIds);
        if (cancelled) return;
        if (itemsError) { console.warn('Erro ao carregar semana (items):', itemsError.message); return; }

        const mealDateMap: Record<string, string> = {};
        mealsData.forEach(m => { mealDateMap[m.id] = m.data; });

        const dailyTotals: Record<string, { calorias: number; proteina: number; carbo: number; gordura: number }> = {};
        dates.forEach(d => { dailyTotals[d] = { calorias: 0, proteina: 0, carbo: 0, gordura: 0 }; });

        const weekItemRows = ((items || []) as unknown as WeekItemRow[]);
        weekItemRows.forEach((item) => {
          const date = mealDateMap[item.meal_id];
          if (date && dailyTotals[date]) {
            dailyTotals[date].calorias += item.calorias_calculadas;
            dailyTotals[date].proteina += item.proteina;
            dailyTotals[date].carbo += item.carbo;
            dailyTotals[date].gordura += item.gordura;
          }
        });

        if (!cancelled) {
          setWeekData(dates.map(date => ({
            date,
            label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3),
            ...dailyTotals[date],
          })));
          setWeekMealRows(mealsData as WeekMealRow[]);
          setWeekItems(weekItemRows);
        }
      } catch (e) {
        if (!cancelled) console.error('[NutritionSummary] Erro ao carregar semana:', e);
      } finally {
        if (!cancelled) setLoadingWeek(false);
      }
    };
    loadWeek();
    return () => { cancelled = true; };
  }, [open, tab, userId, selectedDate]);

  const calProgress = metaFinal > 0 ? Math.min((summary.calorias / metaFinal) * 100, 100) : 0;

  const totalMacroG = summary.proteina + summary.carbo + summary.gordura;
  const donutData = totalMacroG > 0 ? [
    { name: 'Proteína', value: summary.proteina },
    { name: 'Carbo', value: summary.carbo },
    { name: 'Gordura', value: summary.gordura },
  ] : [{ name: 'Vazio', value: 1 }];

  const macroRows = [
    { label: 'Proteína', consumed: summary.proteina, goal: macroMetas.proteina.g },
    { label: 'Carboidratos', consumed: summary.carbo, goal: macroMetas.carbo.g },
    { label: 'Gordura', consumed: summary.gordura, goal: macroMetas.gordura.g },
  ];

  const microRows = [
    { label: 'Fibras', consumed: microTotals.fibras, goal: profile.meta_fibras, unit: 'g' },
    { label: 'Sódio', consumed: microTotals.sodio, goal: profile.meta_sodio, unit: 'mg' },
    { label: 'Açúcares', consumed: microTotals.acucares, goal: profile.meta_acucares, unit: 'g' },
    { label: 'Gord. Saturada', consumed: microTotals.gordura_saturada, goal: profile.meta_gordura_saturada, unit: 'g' },
    { label: 'Colesterol', consumed: microTotals.colesterol, goal: profile.meta_colesterol, unit: 'mg' },
    { label: 'Potássio', consumed: microTotals.potassio, goal: profile.meta_potassio, unit: 'mg' },
  ];

  const weekAvg = useMemo(() => {
    if (weekData.length === 0) return { calorias: 0, proteina: 0, carbo: 0, gordura: 0 };
    const daysWithData = weekData.filter(d => d.calorias > 0);
    const count = daysWithData.length || 1;
    return {
      calorias: daysWithData.reduce((s, d) => s + d.calorias, 0) / count,
      proteina: daysWithData.reduce((s, d) => s + d.proteina, 0) / count,
      carbo: daysWithData.reduce((s, d) => s + d.carbo, 0) / count,
      gordura: daysWithData.reduce((s, d) => s + d.gordura, 0) / count,
    };
  }, [weekData]);

  const weekTotals = useMemo(() => {
    if (weekData.length === 0) return { calorias: 0, proteina: 0, carbo: 0, gordura: 0 };
    return {
      calorias: weekData.reduce((s, d) => s + d.calorias, 0),
      proteina: weekData.reduce((s, d) => s + d.proteina, 0),
      carbo: weekData.reduce((s, d) => s + d.carbo, 0),
      gordura: weekData.reduce((s, d) => s + d.gordura, 0),
    };
  }, [weekData]);

  const weekCalProgress = metaFinal * 7 > 0 ? Math.min((weekTotals.calorias / (metaFinal * 7)) * 100, 100) : 0;
  const weekTotalMacroG = weekTotals.proteina + weekTotals.carbo + weekTotals.gordura;
  const weekDonutData = weekTotalMacroG > 0 ? [
    { name: 'Proteína', value: weekTotals.proteina },
    { name: 'Carbo', value: weekTotals.carbo },
    { name: 'Gordura', value: weekTotals.gordura },
  ] : [{ name: 'Vazio', value: 1 }];

  const weekMacroRows = [
    { label: 'Proteína', consumed: weekTotals.proteina, goal: macroMetas.proteina.g * 7 },
    { label: 'Carboidratos', consumed: weekTotals.carbo, goal: macroMetas.carbo.g * 7 },
    { label: 'Gordura', consumed: weekTotals.gordura, goal: macroMetas.gordura.g * 7 },
  ];

  // Load week micronutrients
  const [weekMicroTotals, setWeekMicroTotals] = useState({ ...EMPTY_MICROS });

  useEffect(() => {
    if (!open || tab !== 'semana' || weekData.length === 0) return;
    let cancelled = false;
    const loadWeekMicros = async () => {
      try {
        const dates = weekData.map(d => d.date);
        const { data: mealsData, error: mealsError } = await supabase.from('meals').select('id').eq('user_id', userId).in('data', dates);
        if (cancelled) return;
        if (mealsError) { console.warn('Erro ao carregar micros da semana (meals):', mealsError.message); return; }
        if (!mealsData || mealsData.length === 0) return;
        const mealIds = mealsData.map(m => m.id);
        const { data: items, error: itemsError } = await supabase.from('meal_items').select('quantidade, food:foods(*)').in('meal_id', mealIds);
        if (cancelled) return;
        if (itemsError) { console.warn('Erro ao carregar micros da semana (items):', itemsError.message); return; }
        if (!items) return;
        const totals = { ...EMPTY_MICROS };
        items.forEach((item: any) => {
          if (!item.food) return;
          const f = item.quantidade / 100;
          totals.fibras += (item.food.fibras_por_100 || 0) * f;
          totals.sodio += (item.food.sodio_por_100 || 0) * f;
          totals.acucares += (item.food.acucares_por_100 || 0) * f;
          totals.gordura_saturada += (item.food.gordura_saturada_por_100 || 0) * f;
          totals.colesterol += (item.food.colesterol_por_100 || 0) * f;
          totals.potassio += (item.food.potassio_por_100 || 0) * f;
        });
        if (!cancelled) setWeekMicroTotals(totals);
      } catch (e) {
        if (!cancelled) console.error('[NutritionSummary] Erro ao carregar micros da semana:', e);
      }
    };
    loadWeekMicros();
    return () => { cancelled = true; };
  }, [open, tab, weekData, userId]);

  const weekMicroRows = [
    { label: 'Fibras', consumed: weekMicroTotals.fibras, goal: profile.meta_fibras * 7, unit: 'g' },
    { label: 'Sódio', consumed: weekMicroTotals.sodio, goal: profile.meta_sodio * 7, unit: 'mg' },
    { label: 'Açúcares', consumed: weekMicroTotals.acucares, goal: profile.meta_acucares * 7, unit: 'g' },
    { label: 'Gord. Saturada', consumed: weekMicroTotals.gordura_saturada, goal: profile.meta_gordura_saturada * 7, unit: 'g' },
    { label: 'Colesterol', consumed: weekMicroTotals.colesterol, goal: profile.meta_colesterol * 7, unit: 'mg' },
    { label: 'Potássio', consumed: weekMicroTotals.potassio, goal: profile.meta_potassio * 7, unit: 'mg' },
  ];

  // ── Composição por refeição (sub-aba "Refeições") ────────────────────────
  const orderIdx = (tipo: string) => { const i = mealOrder.indexOf(tipo); return i === -1 ? 999 : i; };
  const dayComposition = useMemo(
    () => composeMealsForDay([...meals].sort((a, b) => orderIdx(a.tipo) - orderIdx(b.tipo))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meals, mealOrder],
  );
  const weekComposition = useMemo(
    () => composeMealsForWeek(weekMealRows, weekItems, mealOrder),
    [weekMealRows, weekItems, mealOrder],
  );

  const tabsBar = (
    <div className="flex border-b border-border bg-card" role="tablist" aria-label="Período">
      {(['hoje', 'semana'] as Tab[]).map(t => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={tab === t}
          className={`pressable flex-1 py-2.5 text-sm font-body border-b-2 -mb-px ${
            tab === t ? 'text-primary border-primary font-medium' : 'text-muted-foreground border-transparent'
          }`}
          onClick={() => setTab(t)}
        >
          {t === 'hoje' ? 'Hoje' : 'Semana'}
        </button>
      ))}
    </div>
  );

  const subTabs = (
    <div className="flex gap-1 border border-border bg-secondary/40 p-1" role="tablist" aria-label="Visualização">
      {(['resumo', 'refeicoes'] as SubTab[]).map(s => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={sub === s}
          onClick={() => setSub(s)}
          className={`pressable flex-1 py-1.5 text-xs font-heading uppercase tracking-wider ${
            sub === s ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {s === 'resumo' ? 'Resumo' : 'Refeições'}
        </button>
      ))}
    </div>
  );

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Resumo Nutricional"
      description="Calorias, macros e micronutrientes do dia e da semana"
      className="max-h-[90vh]"
      subheader={tabsBar}
    >
      <div className="p-4 space-y-4 bottom-sheet-content">
        {subTabs}

        <div key={`${tab}-${sub}`} className="fade-enter space-y-4">
          {tab === 'hoje' && sub === 'resumo' && (
            <>
              {/* Calories */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <p className="text-sm text-muted-foreground font-body">Calorias</p>
                  <p className="font-heading font-bold">
                    {Math.round(summary.calorias)} <span className="text-sm font-normal text-muted-foreground">/ {metaFinal} kcal</span>
                  </p>
                </div>
                <Progress value={calProgress} className="h-2" />
              </div>

              {/* Donut chart */}
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {donutData.map((d, i) => (
                          <Cell key={d.name} fill={totalMacroG > 0 ? DONUT_COLORS[i] : 'hsl(var(--muted))'} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1">
                  {totalMacroG > 0 && donutData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-medium">{Math.round((d.value / totalMacroG) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Macro table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Macro</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Consumido</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Meta</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {macroRows.map(r => (
                      <tr key={r.label} className="border-t border-border">
                        <td className="px-3 py-2 font-body">{r.label}</td>
                        <td className="text-right px-3 py-2">{Math.round(r.consumed)}g</td>
                        <td className="text-right px-3 py-2 text-muted-foreground">{r.goal}g</td>
                        <td className="text-right px-3 py-2 font-medium">
                          {r.goal > 0 ? `${Math.round((r.consumed / r.goal) * 100)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Micronutrients */}
              <div>
                <h3 className="text-sm font-heading font-semibold mb-2">Micronutrientes</h3>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-secondary/50">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nutriente</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Consumido</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Meta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {microRows.map(r => {
                        const pct = r.goal > 0 ? (r.consumed / r.goal) : 0;
                        const overLimit = pct > 1 && ['Sódio', 'Açúcares', 'Gord. Saturada', 'Colesterol'].includes(r.label);
                        return (
                          <tr key={r.label} className="border-t border-border">
                            <td className="px-3 py-2 font-body">{r.label}</td>
                            <td className={`text-right px-3 py-2 ${overLimit ? 'text-destructive font-medium' : ''}`}>
                              {Math.round(r.consumed)}{r.unit}
                            </td>
                            <td className="text-right px-3 py-2 text-muted-foreground">{r.goal}{r.unit}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {tab === 'hoje' && sub === 'refeicoes' && (
            <MealCompositionList rows={dayComposition} emptyText="Nenhuma refeição com alimentos hoje." />
          )}

          {tab === 'semana' && loadingWeek && (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner size={24} label="Carregando semana" />
              Carregando...
            </div>
          )}

          {tab === 'semana' && !loadingWeek && sub === 'refeicoes' && (
            <MealCompositionList
              rows={weekComposition}
              showDays
              emptyText="Nenhuma refeição com alimentos nos últimos 7 dias."
            />
          )}

          {tab === 'semana' && !loadingWeek && sub === 'resumo' && (
            <>
              {/* Weekly Calories */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <p className="text-sm text-muted-foreground font-body">Calorias (semana)</p>
                  <p className="font-heading font-bold">
                    {Math.round(weekTotals.calorias)} <span className="text-sm font-normal text-muted-foreground">/ {metaFinal * 7} kcal</span>
                  </p>
                </div>
                <Progress value={weekCalProgress} className="h-2" />
              </div>

              {/* Weekly Donut chart */}
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={weekDonutData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value" stroke="none">
                        {weekDonutData.map((d, i) => (
                          <Cell key={d.name} fill={weekTotalMacroG > 0 ? DONUT_COLORS[i] : 'hsl(var(--muted))'} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1">
                  {weekTotalMacroG > 0 && weekDonutData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-medium">{Math.round((d.value / weekTotalMacroG) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Macro table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Macro</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Consumido</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Meta (×7)</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekMacroRows.map(r => (
                      <tr key={r.label} className="border-t border-border">
                        <td className="px-3 py-2 font-body">{r.label}</td>
                        <td className="text-right px-3 py-2">{Math.round(r.consumed)}g</td>
                        <td className="text-right px-3 py-2 text-muted-foreground">{Math.round(r.goal)}g</td>
                        <td className="text-right px-3 py-2 font-medium">
                          {r.goal > 0 ? `${Math.round((r.consumed / r.goal) * 100)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Weekly Micronutrients */}
              <div>
                <h3 className="text-sm font-heading font-semibold mb-2">Micronutrientes (semana)</h3>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-secondary/50">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nutriente</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Consumido</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Meta (×7)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekMicroRows.map(r => {
                        const pct = r.goal > 0 ? (r.consumed / r.goal) : 0;
                        const overLimit = pct > 1 && ['Sódio', 'Açúcares', 'Gord. Saturada', 'Colesterol'].includes(r.label);
                        return (
                          <tr key={r.label} className="border-t border-border">
                            <td className="px-3 py-2 font-body">{r.label}</td>
                            <td className={`text-right px-3 py-2 ${overLimit ? 'text-destructive font-medium' : ''}`}>
                              {Math.round(r.consumed)}{r.unit}
                            </td>
                            <td className="text-right px-3 py-2 text-muted-foreground">{Math.round(r.goal)}{r.unit}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bar chart */}
              <div>
                <h3 className="text-sm font-heading font-semibold mb-2">Calorias — Últimos 7 dias</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [`${Math.round(value)} kcal`, 'Calorias']}
                      />
                      <ReferenceLine y={metaFinal} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: 'Meta', fill: 'hsl(var(--destructive))', fontSize: 10, position: 'right' }} />
                      <Bar dataKey="calorias" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Weekly averages */}
              <div>
                <h3 className="text-sm font-heading font-semibold mb-2">Média Diária</h3>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { label: 'Calorias', value: weekAvg.calorias, unit: 'kcal' },
                    { label: 'Proteína', value: weekAvg.proteina, unit: 'g' },
                    { label: 'Carbo', value: weekAvg.carbo, unit: 'g' },
                    { label: 'Gordura', value: weekAvg.gordura, unit: 'g' },
                  ]).map(m => (
                    <div key={m.label} className="rounded-lg border border-border bg-secondary/50 p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground mb-0.5">{m.label}</p>
                      <p className="font-heading font-bold text-sm">{Math.round(m.value)}</p>
                      <p className="text-[10px] text-muted-foreground">{m.unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
