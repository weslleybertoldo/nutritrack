import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Meal, MealItem, TipoRefeicao, TIPO_REFEICAO_LABELS, REFEICOES_PADRAO } from '@/types';
import { calcularComposicaoCorporal, calcularPercentualGordura3Dobras, calcularIdade, displayDate, formatDate } from '@/lib/calculations';
import { Plus, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, GripVertical, BarChart3, RefreshCw, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/components/AppLayout';
import AddFoodModal from '@/components/AddFoodModal';
import EditMealItemModal from '@/components/EditMealItemModal';
import NutritionSummaryModal from '@/components/NutritionSummaryModal';
import WeekBar from '@/components/WeekBar';
import HydrationCard from '@/components/HydrationCard';
import HabitosCard from '@/components/HabitosCard';
import { supabase } from '@/integrations/supabase/client';
import UpdateChecker, { CURRENT_VERSION } from '@/components/UpdateChecker';

interface MealConfigItem { id: string; tipo: string; nome_personalizado?: string; ordem: number; }

export default function DiaryPage() {
  const {
    profile, selectedDate, setSelectedDate,
    addMeal, removeMeal, removeMealItem, updateMealItem,
    getMealsForDate, getDaySummary, getMetaCalorica, getMacroMetas,
  } = useApp();
  const { user } = useAuth();

  const [addFoodMealId, setAddFoodMealId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ mealId: string; item: MealItem } | null>(null);
  const [showNutritionSummary, setShowNutritionSummary] = useState(false);
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});
  const [addingMealType, setAddingMealType] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<null | { hasUpdate: boolean; url?: string; version?: string }>(null);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateResult(null);
    try {
      const res = await fetch("https://api.github.com/repos/weslleybertoldo/nutritrack/releases/latest", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const release = await res.json();
      const remoteVersion = (release.tag_name || "").replace(/^v/, "");
      const remote = remoteVersion.split(".").map(Number);
      const local = CURRENT_VERSION.split(".").map(Number);
      const isNewer =
        remote[0] > local[0] ||
        (remote[0] === local[0] && remote[1] > local[1]) ||
        (remote[0] === local[0] && remote[1] === local[1] && remote[2] > local[2]);
      if (isNewer) {
        const apkAsset = (release.assets || []).find((a: any) => a.name.endsWith(".apk"));
        setUpdateResult({ hasUpdate: true, url: apkAsset?.browser_download_url || release.html_url, version: remoteVersion });
      } else {
        setUpdateResult({ hasUpdate: false });
      }
    } catch {
      setUpdateResult({ hasUpdate: false });
    } finally {
      setCheckingUpdate(false);
    }
  };

  // ── Configuração persistente de refeições do usuário ─────────────────────
  const [mealConfig, setMealConfig] = useState<MealConfigItem[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Carrega config do banco
  const loadMealConfig = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_meal_config')
      .select('id, tipo, nome_personalizado, ordem')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .order('ordem');
    if (error) { console.warn('Erro ao carregar config de refeições:', error.message); setConfigLoaded(true); return; }
    if (data) {
      setMealConfig(data as MealConfigItem[]);
      if (data.length === 0) await initDefaultMealConfig();
    }
    setConfigLoaded(true);
  }, [user]);

  const initDefaultMealConfig = async () => {
    if (!user) return;
    const defaults = REFEICOES_PADRAO.map((tipo, i) => ({
      user_id: user.id, tipo, ordem: i, ativo: true,
    }));
    const { data, error } = await supabase
      .from('user_meal_config').insert(defaults)
      .select('id, tipo, nome_personalizado, ordem');
    if (error) { console.warn('Erro ao criar config padrão:', error.message); return; }
    if (data) setMealConfig(data as MealConfigItem[]);
  };

  useEffect(() => { loadMealConfig(); }, [loadMealConfig]);

  const todayMeals = getMealsForDate(selectedDate);
  const summary = getDaySummary(selectedDate);
  const { metaFinal } = getMetaCalorica();
  const macroMetas = getMacroMetas();
  const calProgress = metaFinal > 0 ? Math.min((summary.calorias / metaFinal) * 100, 100) : 0;

  const toggleMeal = (id: string) =>
    setExpandedMeals(prev => ({ ...prev, [id]: !prev[id] }));

  const navigateWeek = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta * 7);
    setSelectedDate(formatDate(d));
  };

  const calDiff = summary.calorias - metaFinal;

  const getWarningMessage = () => {
    if (metaFinal <= 0) return null;
    const abs = Math.round(Math.abs(calDiff));
    if (calDiff >= -50 && calDiff <= 50) return { type: 'done' as const, text: '✅ Meta calórica atingida hoje!' };
    if (calDiff > 50) {
      if (profile.objetivo === 'perder') return { type: 'over' as const, text: `⚠️ Você ultrapassou seu déficit hoje em ${abs} kcal` };
      return { type: 'over' as const, text: `🔴 Você consumiu ${abs} kcal acima da sua meta hoje` };
    }
    if (profile.objetivo === 'ganhar') return { type: 'under' as const, text: `💪 Faltam ${abs} kcal para seu superávit de hoje` };
    return { type: 'under' as const, text: `🟡 Faltam ${abs} kcal para sua meta de hoje` };
  };

  const warning = getWarningMessage();

  // Adiciona refeição ao config e cria no dia atual
  const handleAddMeal = async (tipo: TipoRefeicao, nomePersonalizado?: string) => {
    await addMeal({ data: selectedDate, tipo, nome_personalizado: nomePersonalizado });
    if (user && !mealConfig.some(mc => mc.tipo === tipo)) {
      const maxOrdem = mealConfig.length > 0 ? Math.max(...mealConfig.map(m => m.ordem)) + 1 : 0;
      const { data } = await supabase
        .from('user_meal_config')
        .insert({ user_id: user.id, tipo, nome_personalizado: nomePersonalizado || null, ordem: maxOrdem, ativo: true })
        .select('id, tipo, nome_personalizado, ordem').single();
      if (data) setMealConfig(prev => [...prev, data as MealConfigItem]);
    }
    setAddingMealType(false);
  };

  // Remove refeição do config (some de todos os dias)
  const handleRemoveMealConfig = async (mealId: string, tipo: string) => {
    await removeMeal(mealId);
    if (user) {
      await supabase.from('user_meal_config').update({ ativo: false }).eq('user_id', user.id).eq('tipo', tipo);
      setMealConfig(prev => prev.filter(m => m.tipo !== tipo));
    }
  };

  // Tipos padrão ainda não na config
  const availableTypesToAdd = REFEICOES_PADRAO.filter(t => !mealConfig.some(mc => mc.tipo === t));

  // Body composition
  const bodyComp = useMemo(() => {
    if (!profile.peso || !profile.data_nascimento || !profile.sexo) return null;
    const idade = calcularIdade(profile.data_nascimento);
    let d1 = 0, d2 = 0, d3 = 0;
    if (profile.sexo === 'masculino') { d1 = profile.dc_peitoral || 0; d2 = profile.dc_abdominal || 0; d3 = profile.dc_coxa || 0; }
    else { d1 = profile.dc_tricipital || 0; d2 = profile.dc_suprailiaca || 0; d3 = profile.dc_coxa || 0; }
    if (d1 === 0 && d2 === 0 && d3 === 0) return null;
    const pct = calcularPercentualGordura3Dobras(profile.sexo, idade, { d1, d2, d3 });
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
    const comp = calcularComposicaoCorporal(profile.peso, pct);
    return { pct: pct.toFixed(1), ...comp };
  }, [profile]);

  // Lista de refeições para exibir — config define quais aparecem sempre
  const displayMeals = useMemo(() => {
    if (!configLoaded) return todayMeals;
    return mealConfig.map(config => {
      const existing = todayMeals.find(m => m.tipo === config.tipo);
      if (existing) return { ...existing, _configId: config.id };
      return {
        id: `placeholder_${config.tipo}`,
        tipo: config.tipo as any,
        nome_personalizado: config.nome_personalizado || null,
        data: selectedDate,
        user_id: user?.id || '',
        items: [],
        _configId: config.id,
        _placeholder: true,
      };
    });
  }, [mealConfig, todayMeals, configLoaded, selectedDate, user]);

  return (
    <AppLayout
      title={displayDate(selectedDate)}
      headerRight={
        <button onClick={() => setShowNutritionSummary(true)} className="text-muted-foreground hover:text-foreground">
          <BarChart3 className="h-5 w-5" />
        </button>
      }
    >
      <WeekBar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigateWeek(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-heading font-semibold text-base">{displayDate(selectedDate)}</span>
        <button onClick={() => navigateWeek(1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day summary */}
      <div className="mb-6 space-y-3">
        <button
          className="flex w-full items-end justify-between cursor-pointer rounded-lg p-2 -mx-2 transition-colors hover:bg-secondary/50 active:bg-secondary/70"
          onClick={() => setShowNutritionSummary(true)}
        >
          <div className="text-left">
            <p className="text-sm text-muted-foreground font-body">Calorias</p>
            <p className="font-heading text-2xl font-bold">
              {Math.round(summary.calorias)} <span className="text-base font-normal text-muted-foreground">/ {metaFinal} kcal</span>
            </p>
          </div>
          <ChevronRightIcon className="h-4 w-4 text-muted-foreground mb-1.5" />
        </button>
        <Progress value={calProgress} className="h-2.5" />

        {warning && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-body ${
            warning.type === 'over' ? 'bg-destructive/10 text-destructive' :
            warning.type === 'done' ? 'bg-success/10 text-success' :
            'bg-warning/10 text-warning-foreground'
          }`}>
            <span>{warning.text}</span>
          </div>
        )}

        {/* Macro mini cards */}
        <div className="grid grid-cols-3 gap-2">
          {([
            { label: 'Proteína', consumed: summary.proteina, goal: macroMetas.proteina.g, color: 'text-primary' },
            { label: 'Carbo', consumed: summary.carbo, goal: macroMetas.carbo.g, color: 'text-warning-foreground' },
            { label: 'Gordura', consumed: summary.gordura, goal: macroMetas.gordura.g, color: 'text-caution' },
          ] as const).map(m => (
            <div key={m.label} className="rounded-lg border border-border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
              <p className={`font-heading font-bold text-sm ${m.color}`}>{Math.round(m.consumed)}g</p>
              <p className="text-xs text-muted-foreground">/ {m.goal}g</p>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-border mb-4" />

      {/* Meals */}
      {displayMeals.map((meal: any) => {
        const isPlaceholder = meal._placeholder === true;
        const isExpanded = expandedMeals[meal.id] === true;
        const mealCals = (meal.items || []).reduce((s: number, i: any) => s + i.calorias_calculadas, 0);

        return (
          <div
            key={meal.id}
            className={`rounded-lg border bg-card mb-3 overflow-hidden transition-opacity ${
              draggingId === meal.id ? 'opacity-40 border-primary' : 'border-border'
            }`}
            draggable
            onDragStart={() => setDraggingId(meal.id)}
            onDragOver={e => e.preventDefault()}
            onDrop={async () => {
              if (!draggingId || draggingId === meal.id) return;
              const ids = displayMeals.map((m: any) => m.id);
              const from = ids.indexOf(draggingId);
              const to = ids.indexOf(meal.id);
              if (from === -1 || to === -1) return;
              const newConfig = [...mealConfig];
              const [moved] = newConfig.splice(from, 1);
              newConfig.splice(to, 0, moved);
              const updated = newConfig.map((mc, i) => ({ ...mc, ordem: i }));
              setMealConfig(updated);
              if (user) {
                for (const mc of updated) {
                  const { error } = await supabase.from('user_meal_config').update({ ordem: mc.ordem }).eq('id', mc.id);
                  if (error) console.warn('Erro ao reordenar refeição:', error.message);
                }
              }
              setDraggingId(null);
            }}
            onDragEnd={() => setDraggingId(null)}
          >
            <button
              className="flex w-full items-center justify-between p-3"
              onClick={async () => {
                if (isPlaceholder) {
                  const created = await addMeal({ data: selectedDate, tipo: meal.tipo, nome_personalizado: meal.nome_personalizado });
                  if (created) setExpandedMeals(prev => ({ ...prev, [created.id]: true }));
                } else {
                  toggleMeal(meal.id);
                }
              }}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 mr-1 shrink-0 cursor-grab" />
              <div className="text-left flex-1">
                <p className="font-heading font-semibold text-sm">
                  {meal.nome_personalizado || TIPO_REFEICAO_LABELS[meal.tipo as TipoRefeicao] || meal.tipo}
                </p>
                <p className="text-xs text-muted-foreground font-body">
                  {isPlaceholder ? 'Vazio' : `${Math.round(mealCals)} kcal`}
                </p>
              </div>
              {!isPlaceholder && (isExpanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
            </button>

            {!isPlaceholder && isExpanded && (
              <div className="border-t border-border">
                {(meal.items || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-3 font-body">Nenhum alimento adicionado.</p>
                ) : (
                  <div>
                    {(meal.items || []).map((item: any) => (
                      <button
                        key={item.id}
                        className="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => setEditingItem({ mealId: meal.id, item })}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body truncate">{item.food?.nome || 'Alimento'}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantidade}{item.food?.unidade || 'g'} · {Math.round(item.calorias_calculadas)} kcal
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground text-right ml-2 shrink-0">
                          <span>P{Math.round(item.proteina)}</span>
                          <span className="mx-1">C{Math.round(item.carbo)}</span>
                          <span>G{Math.round(item.gordura)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 p-2 border-t border-border">
                  <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={() => setAddFoodMealId(meal.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive"
                    onClick={() => handleRemoveMealConfig(meal.id, meal.tipo)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {isPlaceholder && (
              <div className="border-t border-border px-3 py-2 flex gap-2">
                <Button size="sm" variant="ghost" className="flex-1 text-xs"
                  onClick={async () => {
                    const created = await addMeal({ data: selectedDate, tipo: meal.tipo, nome_personalizado: meal.nome_personalizado });
                    if (created) setAddFoodMealId(created.id);
                  }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar alimento
                </Button>
                <Button size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (user) {
                      await supabase.from('user_meal_config').update({ ativo: false }).eq('user_id', user.id).eq('tipo', meal.tipo);
                      setMealConfig(prev => prev.filter(m => m.tipo !== meal.tipo));
                    }
                  }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Adicionar nova refeição */}
      {availableTypesToAdd.length > 0 && !addingMealType && (
        <Button variant="outline" size="sm" className="w-full mb-4" onClick={() => setAddingMealType(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar Refeição
        </Button>
      )}

      {addingMealType && (
        <div className="rounded-lg border border-border bg-card p-3 mb-4 space-y-1">
          {availableTypesToAdd.map(tipo => (
            <button key={tipo}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm font-body transition-colors"
              onClick={() => handleAddMeal(tipo)}>
              {TIPO_REFEICAO_LABELS[tipo]}
            </button>
          ))}
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setAddingMealType(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {/* Hydration */}
      <HydrationCard selectedDate={selectedDate} pesoKg={profile.peso} />

      {/* Hábitos diários */}
      <HabitosCard selectedDate={selectedDate} />

      {/* Body composition */}
      {bodyComp && (
        <>
          <hr className="border-border mb-4" />
          <section className="mb-8">
            <h2 className="text-sm font-heading font-semibold mb-3">Composição Corporal</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-lg font-heading font-bold">{bodyComp.pct}%</p>
                <p className="text-xs text-muted-foreground font-body">Gordura</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-lg font-heading font-bold">{bodyComp.massaGorda}kg</p>
                <p className="text-xs text-muted-foreground font-body">M. Gorda</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-lg font-heading font-bold">{bodyComp.massaMagra}kg</p>
                <p className="text-xs text-muted-foreground font-body">M. Magra</p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Rodapé com versão e atualizações */}
      <footer className="pt-8 pb-4 text-center space-y-2">
        <p className="text-xs text-muted-foreground italic">By Weslley Bertoldo</p>
        <p className="text-[10px] text-muted-foreground/50">v{CURRENT_VERSION}</p>
        <button
          type="button"
          onClick={handleCheckUpdate}
          disabled={checkingUpdate}
          className="flex items-center justify-center gap-1 mx-auto text-[10px] text-muted-foreground/50 hover:text-primary transition-colors"
        >
          <RefreshCw size={10} className={checkingUpdate ? "animate-spin" : ""} />
          Verificar atualizações
        </button>
        {updateResult && (
          <div className="mt-1">
            {updateResult.hasUpdate ? (
              <a
                href={updateResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-semibold uppercase tracking-wider hover:bg-primary/90 transition-colors"
              >
                <Download size={10} />
                Baixar v{updateResult.version}
              </a>
            ) : (
              <p className="text-[10px] text-green-500 flex items-center justify-center gap-1">
                <Check size={10} />
                Versão mais recente
              </p>
            )}
          </div>
        )}
      </footer>

      <UpdateChecker />

      {/* Modals */}
      {addFoodMealId && (
        <AddFoodModal mealId={addFoodMealId} onClose={() => setAddFoodMealId(null)} />
      )}

      {editingItem && (
        <EditMealItemModal
          item={editingItem.item}
          onSave={(quantidade, macrosData) => {
            updateMealItem(editingItem.mealId, editingItem.item.id, { quantidade, ...macrosData });
            setEditingItem(null);
          }}
          onRemove={() => {
            removeMealItem(editingItem.mealId, editingItem.item.id);
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)}
        />
      )}

      {showNutritionSummary && user && (
        <NutritionSummaryModal
          selectedDate={selectedDate}
          summary={summary}
          metaFinal={metaFinal}
          macroMetas={macroMetas}
          profile={profile}
          userId={user.id}
          onClose={() => setShowNutritionSummary(false)}
        />
      )}
    </AppLayout>
  );
}
