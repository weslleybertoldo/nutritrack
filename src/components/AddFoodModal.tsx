import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { Food, Recipe } from '@/types';
import { X, Search, Star, Clock, BookOpen, Plus, ScanBarcode, Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import CreateFoodForm from '@/components/CreateFoodForm';
import NutritionTable from '@/components/NutritionTable';
import BarcodeScanner from '@/components/BarcodeScanner';
import RecipeModal from '@/components/RecipeModal';
import { toast } from 'sonner';

interface AddFoodModalProps {
  mealId: string;
  onClose: () => void;
}

type Tab = 'pesquisar' | 'favoritos' | 'recentes' | 'receitas';

export default function AddFoodModal({ mealId, onClose }: AddFoodModalProps) {
  const {
    foods, favorites, recentFoods, recentFoodsWithQty,
    addMealItem, toggleFavorite, addRecentFood, refreshRecentFoods, searchFoodByBarcode,
    recipes, loadRecipes, createRecipe, updateRecipe, deleteRecipe, addRecipeToMeal,
  } = useApp();
  const [tab, setTab] = useState<Tab>('pesquisar');
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantidadeStr, setQuantidadeStr] = useState('100');
  const [showCreateFood, setShowCreateFood] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [barcodeForCreate, setBarcodeForCreate] = useState<string | undefined>();
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);

  const quantidadeNum = quantidadeStr === '' ? 0 : parseFloat(quantidadeStr) || 0;

  const filteredFoods = useMemo(() => {
    if (!search.trim()) return foods.slice(0, 20);
    const q = search.toLowerCase();
    return foods.filter(f => f.nome.toLowerCase().includes(q));
  }, [foods, search]);

  const favoriteFoods = useMemo(() => foods.filter(f => favorites.includes(f.id)), [foods, favorites]);
  const recentFoodList = useMemo(() =>
    recentFoodsWithQty.map(r => {
      const food = foods.find(f => f.id === r.food_id);
      return food ? { food, quantidade: r.quantidade } : null;
    }).filter(Boolean) as { food: Food; quantidade: number }[],
    [foods, recentFoodsWithQty]
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
    setSelectedFood(null);
    setQuantidadeStr('100');
    onClose();
  };

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
        setShowCreateFood(true);
      }
    } catch (e) {
      console.error('[AddFoodModal] Erro ao buscar por código:', e);
      toast.error('Erro ao buscar alimento. Tente novamente.');
    }
  }, [searchFoodByBarcode]);

  const handleAddRecipeToMeal = async (recipe: Recipe) => {
    try {
      await addRecipeToMeal(recipe, mealId);
      toast.success(`Receita "${recipe.nome}" adicionada!`);
      onClose();
    } catch (e) {
      console.error('[AddFoodModal] Erro ao adicionar receita:', e);
      toast.error('Erro ao adicionar receita.');
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
    return (
      <button
        key={food.id}
        className={`flex w-full items-center justify-between border-b border-border px-1 py-3 text-left transition-colors hover:bg-secondary/50 ${
          selectedFood?.id === food.id ? 'bg-primary/5' : ''
        }`}
        onClick={() => {
          setSelectedFood(food);
          setQuantidadeStr(lastQty ? String(lastQty) : '100');
        }}
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
          onClick={(e) => { e.stopPropagation(); toggleFavorite(food.id); }}
          className={`ml-2 p-1 ${isFav ? 'text-warning' : 'text-muted-foreground'}`}
        >
          <Star className="h-4 w-4" fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </button>
    );
  };

  if (showScanner) {
    return <BarcodeScanner onScanned={handleBarcodeScanned} onClose={() => setShowScanner(false)} />;
  }

  if (showCreateFood) {
    return (
      <div className="modal-overlay">
        <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => { setShowCreateFood(false); setBarcodeForCreate(undefined); }} />
        <div className="absolute bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl bg-card animate-slide-up flex flex-col">
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shrink-0">
            <h2 className="font-heading font-semibold">Criar Alimento</h2>
            <button onClick={() => { setShowCreateFood(false); setBarcodeForCreate(undefined); }} className="p-1"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 min-h-0 bottom-sheet-content">
            <CreateFoodForm
              initialBarcode={barcodeForCreate}
              onCreated={(food) => { setShowCreateFood(false); setBarcodeForCreate(undefined); setSelectedFood(food); }}
              onExistingFood={(food) => { setShowCreateFood(false); setBarcodeForCreate(undefined); setSelectedFood(food); }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (showRecipeModal) {
    return (
      <RecipeModal
        recipe={editingRecipe}
        foods={foods}
        onSave={async (nome, descricao, itens) => {
          if (editingRecipe) {
            await updateRecipe(editingRecipe.id, nome, descricao || '', itens);
          } else {
            await createRecipe(nome, descricao || '', itens);
          }
          setShowRecipeModal(false);
          setEditingRecipe(null);
        }}
        onClose={() => { setShowRecipeModal(false); setEditingRecipe(null); }}
      />
    );
  }

  return (
    <div className="modal-overlay">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-hidden rounded-t-2xl bg-card animate-slide-up flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-heading font-semibold">Adicionar Alimento</h2>
          <button onClick={onClose} className="p-1"><X className="h-5 w-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-body transition-colors ${
                tab === t.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4">
          {tab === 'pesquisar' && (
            <>
              <div className="sticky top-0 bg-card py-3 z-10">
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar alimento..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="flex items-center justify-center rounded-lg border border-input bg-background px-3 hover:bg-secondary transition-colors"
                    title="Escanear código de barras"
                  >
                    <ScanBarcode className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                <Button variant="ghost" size="sm" className="mt-2 text-primary" onClick={() => setShowCreateFood(true)}>
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
              <Button variant="outline" size="sm" className="w-full" onClick={() => { setEditingRecipe(null); setShowRecipeModal(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nova Receita
              </Button>
              {recipes.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma receita criada.</p>
              )}
              {recipes.map(recipe => {
                const isExpanded = expandedRecipe === recipe.id;
                const totalCal = (recipe.items || []).reduce((s, i) => s + (i.food ? i.food.calorias_por_100 * i.quantidade / 100 : 0), 0);
                const totalP = (recipe.items || []).reduce((s, i) => s + (i.food ? i.food.proteina_por_100 * i.quantidade / 100 : 0), 0);
                const totalC = (recipe.items || []).reduce((s, i) => s + (i.food ? i.food.carbo_por_100 * i.quantidade / 100 : 0), 0);
                const totalG = (recipe.items || []).reduce((s, i) => s + (i.food ? i.food.gordura_por_100 * i.quantidade / 100 : 0), 0);

                return (
                  <div key={recipe.id} className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-3 text-left"
                      onClick={() => setExpandedRecipe(isExpanded ? null : recipe.id)}
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
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>

                    {isExpanded && (
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
                          <Button size="sm" className="flex-1" onClick={() => handleAddRecipeToMeal(recipe)}>
                            <Plus className="h-3 w-3 mr-1" /> Adicionar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingRecipe(recipe); setShowRecipeModal(true); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {deletingRecipeId === recipe.id ? (
                            <div className="flex gap-1">
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteRecipe(recipe.id)}>Sim</Button>
                              <Button size="sm" variant="outline" onClick={() => setDeletingRecipeId(null)}>Não</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setDeletingRecipeId(recipe.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected food: quantity + nutrition + sticky add button */}
        {selectedFood && (
          <div className="border-t border-border bg-card flex flex-col max-h-[55vh]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-body font-medium text-sm truncate flex-1">{selectedFood.nome}</p>
                <button onClick={() => setSelectedFood(null)} className="text-muted-foreground p-1"><X className="h-4 w-4" /></button>
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
            </div>

            <div className="sticky bottom-0 shrink-0 border-t border-border bg-card p-4 pb-safe">
              <Button className="w-full" size="lg" onClick={handleAdd} disabled={quantidadeNum <= 0}>
                + Adicionar à refeição
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
