import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Food, Recipe } from '@/types';
import { X, Search, Star, Clock, BookOpen, Plus, ScanBarcode, Trash2, Pencil, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Spinner } from '@/components/ui/spinner';
import CreateFoodForm from '@/components/CreateFoodForm';
import NutritionTable from '@/components/NutritionTable';
import BarcodeScanner from '@/components/BarcodeScanner';
import EditFoodForm from '@/components/EditFoodForm';
import RecipeModal from '@/components/RecipeModal';
import { useDisclosure, useSheet } from '@/hooks/useSheet';
import { toast } from 'sonner';

interface AddFoodModalProps {
  mealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = 'pesquisar' | 'favoritos' | 'recentes' | 'receitas';

export default function AddFoodModal({ mealId, open, onOpenChange }: AddFoodModalProps) {
  const {
    foods, favorites, recentFoodsWithQty,
    addMealItem, toggleFavorite, addRecentFood, refreshRecentFoods, searchFoodByBarcode,
    recipes, loadRecipes, createRecipe, updateRecipe, deleteRecipe, addRecipeToMeal,
  } = useApp();
  const [tab, setTab] = useState<Tab>('pesquisar');
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantidadeStr, setQuantidadeStr] = useState('100');
  const [showScanner, setShowScanner] = useState(false);
  const [barcodeForCreate, setBarcodeForCreate] = useState<string | undefined>();
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);
  // Receita sendo adicionada à refeição (círculo verde no botão).
  const [addingRecipeId, setAddingRecipeId] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  // Sub-folhas empilhadas por cima desta (cada uma anima entrada e saída).
  const createFood = useDisclosure();
  const editFood = useSheet<Food>();
  const recipeSheet = useSheet<{ recipe: Recipe | null }>();
  const searchRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Foco na busca só depois da folha terminar de subir (teclado no meio da
  // animação dá "pulo" no celular).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (tab === 'pesquisar') searchRef.current?.focus({ preventScroll: true });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const quantidadeNum = quantidadeStr === '' ? 0 : parseFloat(quantidadeStr) || 0;

  const filteredFoods = useMemo(() => {
    if (!search.trim()) return foods.slice(0, 20);
    const q = search.toLowerCase();
    return foods.filter(f => f.nome.toLowerCase().includes(q));
  }, [foods, search]);

  const favoriteFoods = useMemo(() => foods.filter(f => favorites.includes(f.id)), [foods, favorites]);
  const recentFoodList = useMemo(() =>
    recentFoodsWithQty
      .filter(r => r.food)
      .map(r => ({ food: r.food, quantidade: r.quantidade })),
    [recentFoodsWithQty]
  );

  const handleAdd = () => {
    if (!selectedFood || quantidadeNum <= 0) return;
    const factor = quantidadeNum / 100;
    addMealItem(mealId, {
      food_id: selectedFood.id,
      quantidade: quantidadeNum,
      calorias_calculadas: selectedFood.calorias_por_100 * factor,
      proteina: selectedFood.proteina_por_100 * factor,
      carbo: selectedFood.carbo_por_100 * factor,
      gordura: selectedFood.gordura_por_100 * factor,
      food: selectedFood,
    });
    addRecentFood(selectedFood.id, quantidadeNum);
    toast.success(`${selectedFood.nome} adicionado!`);
    setAddedCount(c => c + 1);
    setSelectedFood(null);
    setQuantidadeStr('100');
    // Não fecha o modal — permite adicionar mais alimentos
  };

  const openCreateFood = createFood.show;
  const handleBarcodeScanned = useCallback(async (code: string) => {
    setShowScanner(false);
    try {
      const food = await searchFoodByBarcode(code);
      if (food) {
        setSelectedFood(food);
        setQuantidadeStr('100');
        toast.success(`Encontrado: ${food.nome}`);
      } else {
        toast.info('Alimento não encontrado para este código.');
        setBarcodeForCreate(code);
        openCreateFood();
      }
    } catch (e: any) {
      console.error('[AddFoodModal] Erro ao buscar por código:', e);
      toast.error(e?.message || 'Erro ao buscar alimento. Tente novamente.');
    }
  }, [searchFoodByBarcode, openCreateFood]);

  // Adicionar receita: o AppContext faz 1 insert em lote (era 1 por item, em
  // série); aqui só mostramos o círculo verde enquanto a rede responde.
  const handleAddRecipeToMeal = async (recipe: Recipe) => {
    if (addingRecipeId) return;
    setAddingRecipeId(recipe.id);
    try {
      await addRecipeToMeal(recipe, mealId);
      toast.success(`Receita "${recipe.nome}" adicionada!`);
      close();
    } catch (e) {
      console.error('[AddFoodModal] Erro ao adicionar receita:', e);
      toast.error('Erro ao adicionar receita.');
    } finally {
      setAddingRecipeId(null);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    try {
      await deleteRecipe(recipeId);
      setDeletingRecipeId(null);
      toast.success('Receita excluída.');
    } catch (e) {
      console.error('[AddFoodModal] Erro ao excluir receita:', e);
      toast.error('Erro ao excluir receita.');
    }
  };

  const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: 'pesquisar', icon: Search, label: 'Pesquisar' },
    { id: 'favoritos', icon: Star, label: 'Favoritos' },
    { id: 'recentes', icon: Clock, label: 'Recentes' },
    { id: 'receitas', icon: BookOpen, label: 'Receitas' },
  ];

  const renderFoodItem = (food: Food, lastQty?: number) => {
    const isFav = favorites.includes(food.id);
    const selected = selectedFood?.id === food.id;
    const pick = () => {
      setSelectedFood(food);
      setQuantidadeStr(lastQty ? String(lastQty) : '100');
    };
    return (
      <div
        key={food.id}
        role="button"
        tabIndex={0}
        onClick={pick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
        className={`pressable-row flex w-full cursor-pointer items-center justify-between border-b border-border px-1 py-3 text-left ${
          selected ? 'bg-primary/5' : ''
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-body truncate">{food.nome}</p>
          <p className="text-xs text-muted-foreground">
            {food.calorias_por_100} kcal · P{food.proteina_por_100}g · C{food.carbo_por_100}g · G{food.gordura_por_100}g / 100{food.unidade}
          </p>
          {lastQty !== undefined && (
            <p className="text-xs text-primary/70 mt-0.5">
              Última vez: <strong>{lastQty}{food.unidade}</strong>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleFavorite(food.id); }}
          aria-label={isFav ? 'Remover dos favoritos' : 'Favoritar'}
          className={`pressable-sm ml-2 p-1 ${isFav ? 'text-warning' : 'text-muted-foreground'}`}
        >
          <Star className="h-4 w-4" fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>
    );
  };

  const tabsBar = (
    <div className="flex border-b border-border bg-card" role="tablist" aria-label="Origem do alimento">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          className={`pressable flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-body border-b-2 -mb-px ${
            tab === t.id ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'
          }`}
          onClick={() => {
            setTab(t.id);
            if (t.id === 'recentes') refreshRecentFoods();
            if (t.id === 'receitas') loadRecipes();
          }}
        >
          <t.icon className="h-4 w-4" />
          {t.label}
        </button>
      ))}
    </div>
  );

  // Painel do alimento selecionado (ou botão Concluir) — fixo no rodapé da folha.
  const footer = selectedFood ? (
    <div className="fade-enter shrink-0 border-t border-border bg-card flex flex-col max-h-[55vh]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        <div className="flex items-center justify-between">
          <p className="font-body font-medium text-sm truncate flex-1">{selectedFood.nome}</p>
          <button type="button" onClick={() => setSelectedFood(null)} aria-label="Limpar seleção" className="pressable-sm text-muted-foreground p-1"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-20">Quantidade:</label>
            <input
              type="number"
              inputMode="decimal"
              value={quantidadeStr}
              onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\d*[.,]?\d*$/.test(val)) {
                  setQuantidadeStr(val);
                }
              }}
              onBlur={() => {
                const num = parseFloat(quantidadeStr);
                if (!num || num < 0.1) setQuantidadeStr('1');
              }}
              onFocus={e => e.target.select()}
              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-center font-body focus:outline-none focus:ring-2 focus:ring-ring"
              min={0.1}
            />
            <span className="text-xs text-muted-foreground">{selectedFood.unidade}</span>
          </div>
          <Slider
            value={[quantidadeNum || 10]}
            onValueChange={([v]) => setQuantidadeStr(String(v))}
            min={10}
            max={500}
            step={5}
            className="w-full"
          />
        </div>

        <NutritionTable food={selectedFood} quantidade={quantidadeNum} />

        {/* Botão editar alimento (abaixo dos micronutrientes) */}
        {selectedFood.criado_por && (
          <button
            type="button"
            onClick={() => editFood.show(selectedFood)}
            className="pressable w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-primary font-heading"
          >
            <Pencil className="h-3 w-3" /> Editar alimento
          </button>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] space-y-2">
        <Button className="w-full" size="lg" onClick={handleAdd} disabled={quantidadeNum <= 0}>
          + Adicionar à refeição
        </Button>
        {addedCount > 0 && (
          <Button variant="outline" className="w-full" size="sm" onClick={close}>
            Concluir ({addedCount} adicionado{addedCount > 1 ? 's' : ''})
          </Button>
        )}
      </div>
    </div>
  ) : addedCount > 0 ? (
    <div className="fade-enter shrink-0 border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
      <Button className="w-full" size="lg" onClick={close}>
        Concluir ({addedCount} adicionado{addedCount > 1 ? 's' : ''})
      </Button>
    </div>
  ) : null;

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Adicionar Alimento"
        description="Busque, escolha a quantidade e adicione alimentos ou receitas à refeição"
        subheader={tabsBar}
        footer={footer}
      >
        {/* Content — troca de aba esmaece */}
        <div key={tab} className="fade-enter px-4">
          {tab === 'pesquisar' && (
            <>
              <div className="sticky top-0 bg-card py-3 z-10">
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      ref={searchRef}
                      type="text"
                      placeholder="Buscar alimento..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="pressable flex items-center justify-center rounded-lg border border-input bg-background px-3 hover:bg-secondary"
                    title="Escanear código de barras"
                    aria-label="Escanear código de barras"
                  >
                    <ScanBarcode className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                <Button variant="ghost" size="sm" className="mt-2 text-primary" onClick={() => createFood.show()}>
                  <Plus className="h-4 w-4 mr-1" /> Criar alimento
                </Button>
              </div>
              {filteredFoods.map(f => renderFoodItem(f))}
              {filteredFoods.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum alimento encontrado.</p>
              )}
            </>
          )}
          {tab === 'favoritos' && (
            <div className="py-3">
              {favoriteFoods.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum favorito ainda.</p>}
              {favoriteFoods.map(f => renderFoodItem(f))}
            </div>
          )}
          {tab === 'recentes' && (
            <div className="py-3">
              {recentFoodList.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum alimento recente.</p>}
              {recentFoodList.map(r => renderFoodItem(r.food, r.quantidade))}
            </div>
          )}
          {tab === 'receitas' && (
            <div className="py-3 space-y-3">
              <Button variant="outline" size="sm" className="w-full" onClick={() => recipeSheet.show({ recipe: null })}>
                <Plus className="h-4 w-4 mr-1" /> Nova Receita
              </Button>
              {recipes.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma receita criada.</p>
              )}
              {recipes.map(recipe => {
                const isExpanded = expandedRecipe === recipe.id;
                const adding = addingRecipeId === recipe.id;
                const totalCal = (recipe.items || []).reduce((s, i) => s + (i.food ? i.food.calorias_por_100 * i.quantidade / 100 : 0), 0);
                const totalP = (recipe.items || []).reduce((s, i) => s + (i.food ? i.food.proteina_por_100 * i.quantidade / 100 : 0), 0);
                const totalC = (recipe.items || []).reduce((s, i) => s + (i.food ? i.food.carbo_por_100 * i.quantidade / 100 : 0), 0);
                const totalG = (recipe.items || []).reduce((s, i) => s + (i.food ? i.food.gordura_por_100 * i.quantidade / 100 : 0), 0);

                return (
                  <Collapsible
                    key={recipe.id}
                    open={isExpanded}
                    onOpenChange={(o) => setExpandedRecipe(o ? recipe.id : null)}
                    className="rounded-lg border border-border bg-secondary/30 overflow-hidden"
                  >
                    <button
                      type="button"
                      className="pressable-row w-full flex items-center justify-between p-3 text-left"
                      onClick={() => setExpandedRecipe(isExpanded ? null : recipe.id)}
                      aria-expanded={isExpanded}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body font-medium truncate">{recipe.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {Math.round(totalCal)} kcal · P{Math.round(totalP)}g · C{Math.round(totalC)}g · G{Math.round(totalG)}g
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(recipe.items || []).length} alimento(s)
                        </p>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ease-out ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    <CollapsibleContent>
                      <div className="border-t border-border px-3 pb-3">
                        {recipe.descricao && <p className="text-xs text-muted-foreground py-2">{recipe.descricao}</p>}
                        <div className="space-y-1 py-2">
                          {(recipe.items || []).map(item => (
                            <div key={item.id} className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">{item.quantidade}{item.food?.unidade || 'g'}</span>
                              <span className="font-body truncate">{item.food?.nome || 'Alimento'}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant={adding ? 'outline' : 'default'}
                            className={`flex-1 ${adding ? 'border-primary/60 text-primary' : ''}`}
                            disabled={addingRecipeId !== null}
                            onClick={() => handleAddRecipeToMeal(recipe)}
                            aria-busy={adding}
                          >
                            {adding ? (
                              <><Spinner size={14} /> Adicionando…</>
                            ) : (
                              <><Plus className="h-3 w-3 mr-1" /> Adicionar</>
                            )}
                          </Button>
                          <Button size="sm" variant="outline" disabled={addingRecipeId !== null} aria-label="Editar receita" onClick={() => recipeSheet.show({ recipe })}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {deletingRecipeId === recipe.id ? (
                            <div className="flex gap-1 fade-enter">
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteRecipe(recipe.id)}>Sim</Button>
                              <Button size="sm" variant="outline" onClick={() => setDeletingRecipeId(null)}>Não</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" disabled={addingRecipeId !== null} aria-label="Excluir receita" onClick={() => setDeletingRecipeId(recipe.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>

        {/* Scanner por cima da folha (dentro do Dialog: mantém foco/toque) */}
        {showScanner && (
          <BarcodeScanner onScanned={handleBarcodeScanned} onClose={() => setShowScanner(false)} />
        )}
      </BottomSheet>

      {/* Sub-folhas: criar / editar alimento, receita */}
      {createFood.mounted && (
        <BottomSheet
          open={createFood.open}
          onOpenChange={createFood.onOpenChange}
          title="Criar Alimento"
          description="Cadastre um alimento novo com seus valores nutricionais"
          className="max-h-[90vh]"
          bodyClassName="p-4 bottom-sheet-content"
        >
          <CreateFoodForm
            initialBarcode={barcodeForCreate}
            onCreated={(food) => { createFood.hide(); setBarcodeForCreate(undefined); setSelectedFood(food); }}
            onExistingFood={(food) => { createFood.hide(); setBarcodeForCreate(undefined); setSelectedFood(food); }}
          />
        </BottomSheet>
      )}

      {editFood.mounted && editFood.data && (
        <BottomSheet
          open={editFood.open}
          onOpenChange={editFood.onOpenChange}
          title="Editar Alimento"
          description="Altere os valores nutricionais do alimento"
          className="max-h-[90vh]"
          bodyClassName="p-4 bottom-sheet-content"
        >
          <EditFoodForm
            food={editFood.data}
            onSaved={(updatedFood) => {
              editFood.hide();
              // Se o alimento editado era o selecionado, atualiza
              if (selectedFood?.id === updatedFood.id) setSelectedFood(updatedFood);
            }}
            onCancel={editFood.hide}
          />
        </BottomSheet>
      )}

      {recipeSheet.mounted && recipeSheet.data && (
        <RecipeModal
          open={recipeSheet.open}
          onOpenChange={recipeSheet.onOpenChange}
          recipe={recipeSheet.data.recipe}
          foods={foods}
          onSave={async (nome, descricao, itens) => {
            try {
              const editing = recipeSheet.data?.recipe;
              if (editing) {
                await updateRecipe(editing.id, nome, descricao || '', itens);
              } else {
                await createRecipe(nome, descricao || '', itens);
              }
              recipeSheet.hide();
            } catch (e) {
              console.error('[AddFoodModal] Erro ao salvar receita:', e);
              toast.error('Erro ao salvar receita.');
            }
          }}
        />
      )}
    </>
  );
}
