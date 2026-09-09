import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Meal, MealItem, TipoRefeicao, TIPO_REFEICAO_LABELS, REFEICOES_PADRAO } from '@/types';
import { calcularComposicaoCorporal, calcularPercentualGordura3Dobras, calcularIdade, displayDate, formatDate } from '@/lib/calculations';
import { Plus, Trash2, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, GripVertical, BarChart3, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import AppLayout from '@/components/AppLayout';
import AddFoodModal from '@/components/AddFoodModal';
import EditMealItemModal from '@/components/EditMealItemModal';
import NutritionSummaryModal from '@/components/NutritionSummaryModal';
import WeekBar from '@/components/WeekBar';
import HydrationCard from '@/components/HydrationCard';
import HabitosCard from '@/components/HabitosCard';
import { supabase } from '@/integrations/supabase/client';
import UpdateChecker, { CURRENT_VERSION } from '@/components/UpdateChecker';
import { getCacheData, setCacheData } from '@/lib/offlineSync';
import UpdateDownloadButton from '@/components/UpdateDownloadButton';
import { mergeDuplicateMeals } from '@/lib/mealsMerge';
import { useDisclosure, useSheet } from '@/hooks/useSheet';

interface MealConfigItem { id: string; tipo: string; nome_personalizado?: string; ordem: number; }

// Refeição exibida: a do dia (real ou otimista) ou um placeholder vindo da config.
type DisplayMeal = Meal & { _configId?: string; _placeholder?: boolean };

// Chave estável da refeição na tela: não muda quando o id otimista vira o real,
// então o card não "pisca" nem fecha na troca.
const mealKey = (m: { tipo: string; nome_personalizado?: string | null }) =>
  m.nome_personalizado ? `${m.tipo}:${m.nome_personalizado}` : m.tipo;

export default function DiaryPage() {
  const {
    profile, selectedDate, setSelectedDate,
    addMeal, removeMeal, removeMealItem, updateMealItem,
    getMealsForDate, getDaySummary, getMetaCalorica, getMacroMetas,
  } = useApp();
  const { user } = useAuth();

  // Modais: `useSheet` mantém o conteúdo montado durante a animação de saída
  // (Skill-wbs-navegacao — entrada E saída animadas).
  const addFood = useSheet<string>(); // mealId
  const editItem = useSheet<{ mealId: string; item: MealItem }>();
  const summaryModal = useDisclosure();
  const confirmRemove = useSheet<{ nome: string; run: () => Promise<void> }>();

  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});
  // Refeição placeholder cujo registro ainda está sendo criado no servidor.
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [addingMealType, setAddingMealType] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
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
  // Inicia do CACHE: sem isso, a cada volta pro Diário a tela mostrava as
  // refeições na ordem crua do banco por alguns instantes (bug pré-existente
  // em prod) até o fetch de user_meal_config responder.
  const configCacheKey = user ? `nutritrack_meal_config_${user.id}` : null;
  const [mealConfig, setMealConfig] = useState<MealConfigItem[]>(
    () => (configCacheKey ? getCacheData<MealConfigItem[]>(configCacheKey) : null) || []
  );
  const [configLoaded, setConfigLoaded] = useState<boolean>(() => mealConfig.length > 0);

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
      if (user) setCacheData(`nutritrack_meal_config_${user.id}`, data);
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

  // Rede de segurança: refeições do mesmo tipo no dia (duplicatas antigas) são
  // exibidas como uma só. Antes a tela mostrava só a primeira e o total do dia
  // somava todas — o café da manhã aparecia "0 kcal" com os alimentos escondidos.
  const todayMeals = useMemo(
    () => mergeDuplicateMeals(getMealsForDate(selectedDate)),
    [getMealsForDate, selectedDate],
  );
  const daySummary = getDaySummary(selectedDate);
  const { metaFinal } = getMetaCalorica();
  const macroMetas = getMacroMetas();
  const calProgress = metaFinal > 0 ? Math.min((daySummary.calorias / metaFinal) * 100, 100) : 0;

  const toggleMeal = (key: string) =>
    setExpandedMeals(prev => ({ ...prev, [key]: !prev[key] }));

  const navigateWeek = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta * 7);
    setSelectedDate(formatDate(d));
  };

  const calDiff = daySummary.calorias - metaFinal;

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
    setAddingMealType(false);
    await addMeal({ data: selectedDate, tipo, nome_personalizado: nomePersonalizado });
    if (user && !mealConfig.some(mc => mc.tipo === tipo)) {
      const maxOrdem = mealConfig.length > 0 ? Math.max(...mealConfig.map(m => m.ordem)) + 1 : 0;
      const { data } = await supabase
        .from('user_meal_config')
        .insert({ user_id: user.id, tipo, nome_personalizado: nomePersonalizado || null, ordem: maxOrdem, ativo: true })
        .select('id, tipo, nome_personalizado, ordem').single();
      if (data) setMealConfig(prev => [...prev, data as MealConfigItem]);
    }
  };

  // Remove refeição do config (some de todos os dias)
  const handleRemoveMealConfig = async (mealId: string, tipo: string) => {
    await removeMeal(mealId);
    if (user) {
      await supabase.from('user_meal_config').update({ ativo: false }).eq('user_id', user.id).eq('tipo', tipo);
      setMealConfig(prev => prev.filter(m => m.tipo !== tipo));
    }
  };

  // Toque no card: refeição real alterna; placeholder abre NA HORA (o addMeal
  // já mostra o card otimista) e só o botão "Adicionar" espera o id real
  // chegar, com o círculo verde — antes o toque parecia ignorado por ~1 request.
  const handleOpenMeal = async (meal: DisplayMeal) => {
    const key = mealKey(meal);
    if (!meal._placeholder) { toggleMeal(key); return; }
    setExpandedMeals(prev => ({ ...prev, [key]: true }));
    setCreatingKey(key);
    try {
      await addMeal({ data: selectedDate, tipo: meal.tipo, nome_personalizado: meal.nome_personalizado });
    } finally {
      setCreatingKey(k => (k === key ? null : k));
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
  const displayMeals = useMemo<DisplayMeal[]>(() => {
    if (!configLoaded) {
      const idx = (t: string) => { const i = REFEICOES_PADRAO.indexOf(t as TipoRefeicao); return i === -1 ? 99 : i; };
      return [...todayMeals].sort((a, b) => idx(a.tipo) - idx(b.tipo));
    }
    return mealConfig.map(config => {
      const existing = todayMeals.find(m => m.tipo === config.tipo);
      if (existing) return { ...existing, _configId: config.id };
      return {
        id: `placeholder_${config.tipo}`,
        tipo: config.tipo as TipoRefeicao,
        nome_personalizado: config.nome_personalizado || undefined,
        data: selectedDate,
        user_id: user?.id || '',
        items: [],
        _configId: config.id,
        _placeholder: true,
      };
    });
  }, [mealConfig, todayMeals, configLoaded, selectedDate, user]);

  const mealOrder = useMemo(() => mealConfig.map(c => c.tipo), [mealConfig]);

  return (
    <AppLayout
      title={displayDate(selectedDate)}
      headerRight={
        <button
          type="button"
          onClick={summaryModal.show}
          aria-label="Resumo nutricional"
          className="pressable-sm p-1 text-muted-foreground hover:text-foreground"
        >
          <BarChart3 className="h-5 w-5" />
        </button>
      }
    >
      <WeekBar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-5 border-b border-muted-foreground/30 pb-2">
        <button type="button" onClick={() => navigateWeek(-1)} aria-label="Semana anterior" className="pressable-sm p-2 rounded-lg hover:bg-secondary">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span key={selectedDate} className="fade-enter font-heading text-base uppercase tracking-wider">{displayDate(selectedDate)}</span>
        <button type="button" onClick={() => navigateWeek(1)} aria-label="Próxima semana" className="pressable-sm p-2 rounded-lg hover:bg-secondary">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day summary */}
      <div className="mb-6 space-y-3">
        <button
          type="button"
          className="pressable flex w-full items-end justify-between cursor-pointer rounded-lg p-2 -mx-2 hover:bg-secondary/50 active:bg-secondary/70"
          onClick={summaryModal.show}
        >
          <div className="text-left">
            <p className="label-caps">Calorias</p>
            <p className="font-heading text-3xl">
              {Math.round(daySummary.calorias)} <span className="text-base font-normal text-muted-foreground">/ {metaFinal} kcal</span>
            </p>
          </div>
          <ChevronRightIcon className="h-4 w-4 text-muted-foreground mb-1.5" />
        </button>
        <Progress value={calProgress} className="h-1.5" />

        {warning && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-body transition-colors duration-300 ${
            warning.type === 'over' ? 'bg-destructive/10 text-destructive' :
            warning.type === 'done' ? 'bg-success/10 text-success' :
            'bg-warning/10 text-warning'
          }`}>
            <span>{warning.text}</span>
          </div>
        )}

        {/* Macro mini cards */}
        <div className="grid grid-cols-3 gap-2">
          {([
            { label: 'Proteína', consumed: daySummary.proteina, goal: macroMetas.proteina.g, color: 'text-primary' },
            { label: 'Carbo', consumed: daySummary.carbo, goal: macroMetas.carbo.g, color: 'text-classify-blue' },
            { label: 'Gordura', consumed: daySummary.gordura, goal: macroMetas.gordura.g, color: 'text-caution' },
          ] as const).map(m => {
            const atingiu = m.goal > 0 && m.consumed >= m.goal;
            return (
              <div key={m.label} className="relative border border-muted-foreground/30 p-3 text-center">
                {atingiu && <Check className={`absolute top-1.5 right-1.5 h-3 w-3 opacity-70 ${m.color}`} aria-label="Meta atingida" />}
                <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                <p className={`font-heading font-bold text-sm transition-colors duration-300 ${atingiu ? m.color : 'text-muted-foreground'}`}>{Math.round(m.consumed)}g</p>
                <p className={`text-xs font-medium ${m.color}`}>/ {m.goal}g</p>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="section-divider mb-4" />

      {/* Meals — a lista esmaece ao trocar o dia */}
      <div key={selectedDate} className="fade-enter">
        {displayMeals.map((meal) => {
          const key = mealKey(meal);
          const isPlaceholder = meal._placeholder === true;
          const isExpanded = expandedMeals[key] === true;
          const isCreating = creatingKey === key;
          const items = meal.items || [];
          const mealCals = items.reduce((s, i) => s + i.calorias_calculadas, 0);
          const nome = meal.nome_personalizado || TIPO_REFEICAO_LABELS[meal.tipo as TipoRefeicao] || meal.tipo;

          return (
            <Collapsible
              key={key}
              open={!isPlaceholder && isExpanded}
              onOpenChange={(o) => setExpandedMeals(prev => ({ ...prev, [key]: o }))}
              className={`rounded-lg border bg-card mb-3 overflow-hidden transition-[opacity,border-color] duration-200 ${
                draggingId === meal.id ? 'opacity-40 border-primary' : 'border-border'
              }`}
              draggable
              onDragStart={() => setDraggingId(meal.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={async () => {
                if (!draggingId || draggingId === meal.id) return;
                const ids = displayMeals.map(m => m.id);
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
                type="button"
                className="pressable-row flex w-full items-center justify-between p-3 text-left"
                onClick={() => handleOpenMeal(meal)}
                aria-expanded={!isPlaceholder && isExpanded}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/40 mr-1 shrink-0 cursor-grab" />
                <div className="text-left flex-1">
                  <p className="font-heading text-sm uppercase tracking-wide">{nome}</p>
                  <p className={`text-xs font-body transition-colors duration-300 ${!isPlaceholder && mealCals > 0 ? 'text-brand font-medium' : 'text-muted-foreground'}`}>
                    {isPlaceholder ? 'Vazio' : `${Math.round(mealCals)} kcal`}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ease-out ${!isPlaceholder && isExpanded ? 'rotate-180' : ''}`} />
              </button>

              <CollapsibleContent>
                <div className="border-t border-border">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-3 font-body">Nenhum alimento adicionado.</p>
                  ) : (
                    <div>
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="pressable-row flex w-full items-center justify-between px-3 py-2 text-left"
                          onClick={() => editItem.show({ mealId: meal.id, item })}
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 text-xs text-brand hover:text-brand hover:bg-brand/10"
                      disabled={isCreating}
                      onClick={() => addFood.show(meal.id)}
                    >
                      {isCreating ? <Spinner size={14} /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                      {isCreating ? 'Criando…' : 'Adicionar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-destructive hover:text-destructive"
                      aria-label="Excluir refeição"
                      disabled={isCreating}
                      onClick={() => confirmRemove.show({
                        nome,
                        run: () => handleRemoveMealConfig(meal.id, meal.tipo),
                      })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* Adicionar nova refeição */}
      {availableTypesToAdd.length > 0 && !addingMealType && (
        <Button variant="outline" size="sm" className="w-full mb-4" onClick={() => setAddingMealType(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar Refeição
        </Button>
      )}

      {addingMealType && (
        <div className="fade-enter rounded-lg border border-border bg-card p-3 mb-4 space-y-1">
          {availableTypesToAdd.map(tipo => (
            <button
              key={tipo}
              type="button"
              className="pressable-row w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm font-body"
              onClick={() => handleAddMeal(tipo)}
            >
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
          <hr className="section-divider mb-4" />
          <section className="mb-8">
            <h2 className="text-sm mb-3">Composição Corporal</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-muted-foreground/30 p-3 text-center">
                <p className="text-lg font-heading font-bold">{bodyComp.pct}%</p>
                <p className="text-xs text-muted-foreground font-body">Gordura</p>
              </div>
              <div className="border border-muted-foreground/30 p-3 text-center">
                <p className="text-lg font-heading font-bold">{bodyComp.massaGorda}kg</p>
                <p className="text-xs text-muted-foreground font-body">M. Gorda</p>
              </div>
              <div className="border border-muted-foreground/30 p-3 text-center">
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
          className="pressable flex items-center justify-center gap-1 mx-auto text-[10px] text-muted-foreground/50 hover:text-primary transition-colors"
        >
          <RefreshCw size={10} className={checkingUpdate ? "animate-spin text-primary" : ""} />
          {checkingUpdate ? 'Verificando…' : 'Verificar atualizações'}
        </button>
        {updateResult && (
          <div className="mt-1 fade-enter">
            {updateResult.hasUpdate ? (
              <UpdateDownloadButton url={updateResult.url!} version={updateResult.version!} size="sm" />
            ) : (
              <p className="text-[10px] text-success flex items-center justify-center gap-1">
                <Check size={10} />
                Versão mais recente
              </p>
            )}
          </div>
        )}
      </footer>

      <UpdateChecker />

      {/* Confirmação de exclusão de refeição — AlertDialog animado */}
      <AlertDialog open={confirmRemove.open} onOpenChange={(o) => { if (!o && !removing) confirmRemove.hide(); }}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-none border-muted-foreground/30 bg-card p-6">
          <AlertDialogHeader className="items-center text-center space-y-2 sm:text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center bg-destructive/15 text-destructive">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-lg">Certeza que deseja excluir?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground font-body">
              A refeição <span className="text-foreground font-medium">{confirmRemove.data?.nome}</span> será removida do seu diário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={removing}
              onClick={confirmRemove.hide}
              className="pressable flex-1 h-11 border border-muted-foreground/40 font-heading text-sm uppercase tracking-widest text-foreground hover:bg-secondary disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={removing}
              onClick={async () => {
                if (!confirmRemove.data) return;
                setRemoving(true);
                try { await confirmRemove.data.run(); } finally { setRemoving(false); confirmRemove.hide(); }
              }}
              className="pressable flex-1 h-11 bg-destructive text-destructive-foreground font-heading text-sm uppercase tracking-widest hover:bg-destructive/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {removing ? <><Spinner size={14} className="text-destructive-foreground" /> Excluindo…</> : 'Excluir'}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modals — montados até a animação de saída terminar */}
      {addFood.mounted && addFood.data && (
        <AddFoodModal mealId={addFood.data} open={addFood.open} onOpenChange={addFood.onOpenChange} />
      )}

      {editItem.mounted && editItem.data && (
        <EditMealItemModal
          open={editItem.open}
          onOpenChange={editItem.onOpenChange}
          item={editItem.data.item}
          onSave={(quantidade, macrosData) => {
            if (!editItem.data) return;
            updateMealItem(editItem.data.mealId, editItem.data.item.id, { quantidade, ...macrosData });
            editItem.hide();
          }}
          onRemove={() => {
            if (!editItem.data) return;
            removeMealItem(editItem.data.mealId, editItem.data.item.id);
            editItem.hide();
          }}
        />
      )}

      {summaryModal.mounted && user && (
        <NutritionSummaryModal
          open={summaryModal.open}
          onOpenChange={summaryModal.onOpenChange}
          selectedDate={selectedDate}
          summary={daySummary}
          metaFinal={metaFinal}
          macroMetas={macroMetas}
          profile={profile}
          userId={user.id}
          meals={todayMeals}
          mealOrder={mealOrder}
        />
      )}
    </AppLayout>
  );
}
