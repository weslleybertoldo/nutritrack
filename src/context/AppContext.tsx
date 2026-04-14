import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Profile, Meal, MealItem, Food, Recipe, RecipeItem } from '@/types';
import { calcularMetaCalorica, calcularMacros, formatDate } from '@/lib/calculations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { setCacheData, getCacheData, addPendingOperation } from '@/lib/offlineSync';

const defaultProfile: Profile = {
  nome: '',
  email: '',
  tmb_metodo: 'mifflin',
  nivel_atividade: 1.55,
  ajuste_calorico: 0,
  objetivo: 'manter',
  macro_proteina_multiplicador: 2.2,
  macro_gordura_percentual: 15,
  meta_fibras: 25,
  meta_sodio: 2000,
  meta_acucares: 50,
  meta_gordura_saturada: 20,
  meta_colesterol: 300,
  meta_potassio: 3500,
  tema: 'system',
};

interface RecentFoodWithQty {
  food_id: string;
  quantidade: number;
}

interface AppState {
  profile: Profile;
  foods: Food[];
  meals: Meal[];
  favorites: string[];
  recentFoods: string[];
  recentFoodsWithQty: RecentFoodWithQty[];
  selectedDate: string;
  profileLoaded: boolean;
  recipes: Recipe[];
}

interface AppContextValue extends AppState {
  setProfile: (p: Partial<Profile>) => void;
  setSelectedDate: (d: string) => void;
  addFood: (f: Omit<Food, 'id'>) => Promise<Food>;
  updateFood: (id: string, updates: Partial<Omit<Food, 'id'>>) => Promise<void>;
  addMeal: (m: Omit<Meal, 'id' | 'user_id'>) => Promise<Meal>;
  addMealItem: (mealId: string, item: Omit<MealItem, 'id' | 'meal_id'>) => Promise<void>;
  updateMealItem: (mealId: string, itemId: string, updates: { quantidade: number; calorias_calculadas: number; proteina: number; carbo: number; gordura: number }) => Promise<void>;
  removeMealItem: (mealId: string, itemId: string) => Promise<void>;
  removeMeal: (mealId: string) => Promise<void>;
  toggleFavorite: (foodId: string) => Promise<void>;
  addRecentFood: (foodId: string, quantidade?: number) => Promise<void>;
  refreshRecentFoods: () => Promise<void>;
  getMealsForDate: (date: string) => Meal[];
  getDaySummary: (date: string) => { calorias: number; proteina: number; carbo: number; gordura: number };
  getMetaCalorica: () => ReturnType<typeof calcularMetaCalorica>;
  getMacroMetas: () => ReturnType<typeof calcularMacros>;
  refreshFoods: () => Promise<void>;
  searchFoodByBarcode: (code: string) => Promise<Food | null>;
  loadRecipes: () => Promise<void>;
  createRecipe: (nome: string, descricao: string, itens: { food_id: string; quantidade: number }[]) => Promise<void>;
  updateRecipe: (recipeId: string, nome: string, descricao: string, itens: { food_id: string; quantidade: number }[]) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;
  addRecipeToMeal: (recipe: Recipe, mealId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>({
    profile: defaultProfile,
    foods: [],
    meals: [],
    favorites: [],
    recentFoods: [],
    recentFoodsWithQty: [],
    selectedDate: formatDate(new Date()),
    profileLoaded: false,
    recipes: [],
  });

  // ── MIDNIGHT DATE CHECK ──────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const hoje = formatDate(new Date());
      if (hoje !== state.selectedDate) {
        setState(s => ({ ...s, selectedDate: hoje }));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [state.selectedDate]);

  // ── LOAD PROFILE ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const cacheKey = `nutritrack_profile_${user.id}`;
    const loadProfile = async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
        if (error) throw error;
        if (data) {
          const profileData: Profile = {
            ...defaultProfile,
            id: data.id,
            user_id: data.user_id,
            nome: data.nome || '',
            email: data.email || '',
            foto_url: data.foto_url || undefined,
            data_nascimento: data.data_nascimento || undefined,
            sexo: (data.sexo as Profile['sexo']) || undefined,
            peso: data.peso ?? undefined,
            altura: data.altura ?? undefined,
            tmb_metodo: (data.tmb_metodo as Profile['tmb_metodo']) || 'mifflin',
            nivel_atividade: data.nivel_atividade ?? 1.55,
            ajuste_calorico: data.ajuste_calorico ?? 0,
            objetivo: (data.objetivo as Profile['objetivo']) || 'manter',
            macro_proteina_multiplicador: data.macro_proteina_multiplicador ?? 2.2,
            macro_gordura_percentual: data.macro_gordura_percentual ?? 15,
            dc_tricipital: data.dc_tricipital ?? undefined,
            dc_peitoral: data.dc_peitoral ?? undefined,
            dc_suprailiaca: data.dc_suprailiaca ?? undefined,
            dc_abdominal: data.dc_abdominal ?? undefined,
            dc_coxa: data.dc_coxa ?? undefined,
            percentual_gordura: data.percentual_gordura ?? undefined,
            massa_gorda: data.massa_gorda ?? undefined,
            massa_magra: data.massa_magra ?? undefined,
            meta_fibras: data.meta_fibras ?? 25,
            meta_sodio: data.meta_sodio ?? 2000,
            meta_acucares: data.meta_acucares ?? 50,
            meta_gordura_saturada: data.meta_gordura_saturada ?? 20,
            meta_colesterol: data.meta_colesterol ?? 300,
            meta_potassio: data.meta_potassio ?? 3500,
            tema: (data.tema as Profile['tema']) || 'system',
            user_code: (data as any).user_code ?? undefined,
            admin_locked: (data as any).admin_locked ?? true,
            blocked: (data as any).blocked ?? false,
          };
          setCacheData(cacheKey, profileData);
          setState(s => ({ ...s, profile: profileData, profileLoaded: true }));
        }
      } catch (err: any) {
        console.error('Erro ao carregar perfil:', err?.message);
        // Tenta carregar do cache offline
        const cached = getCacheData<Profile>(cacheKey);
        if (cached) {
          setState(s => ({ ...s, profile: cached, profileLoaded: true }));
        }
      }
    };
    loadProfile();
  }, [user]);

  // ── FOODS: carrega só os 200 mais recentes + busca sob demanda ────────────
  // CORREÇÃO: sem .limit() a tabela foods global pode crescer indefinidamente
  // Carrega os 200 primeiros por nome; busca adicional é feita via searchFoods
  const refreshFoods = useCallback(async () => {
    const cacheKey = `nutritrack_foods_${user?.id || 'global'}`;
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .order('nome')
        .limit(200); // Limite para evitar carregar tabela inteira
      if (error) throw error;
      if (data) {
        const foods = data as unknown as Food[];
        setCacheData(cacheKey, foods);
        setState(s => ({ ...s, foods }));
      }
    } catch (err: any) {
      console.error('Erro ao carregar alimentos:', err?.message);
      const cached = getCacheData<Food[]>(cacheKey);
      if (cached) setState(s => ({ ...s, foods: cached }));
    }
  }, [user]);

  useEffect(() => { if (user) refreshFoods(); }, [user, refreshFoods]);

  // ── MEALS: carrega refeições do dia selecionado ───────────────────────────
  // CORREÇÃO: usa state.selectedDate como dep — sem risco de loop pois
  // setState dentro do useEffect só atualiza state.meals, não selectedDate
  useEffect(() => {
    if (!user) return;
    const cacheKey = `nutritrack_meals_${user.id}_${state.selectedDate}`;
    const loadMeals = async () => {
      try {
        const { data: mealsData, error } = await supabase
          .from('meals')
          .select('*')
          .eq('user_id', user.id)
          .eq('data', state.selectedDate);
        if (error) throw error;
        if (mealsData && mealsData.length > 0) {
          const mealIds = mealsData.map(m => m.id);
          const { data: itemsData, error: itemsErr } = await supabase
            .from('meal_items')
            .select('*, food:foods(*)')
            .in('meal_id', mealIds);
          if (itemsErr) throw itemsErr;
          const mealsWithItems: Meal[] = mealsData.map(m => ({
            ...m, tipo: m.tipo as any,
            items: (itemsData || []).filter(i => i.meal_id === m.id)
              .map(i => ({ ...i, food: i.food as unknown as Food })) as MealItem[],
          }));
          setCacheData(cacheKey, mealsWithItems);
          setState(s => ({ ...s, meals: mealsWithItems }));
        } else {
          setCacheData(cacheKey, []);
          setState(s => ({ ...s, meals: [] }));
        }
      } catch (err: any) {
        console.error('Erro ao carregar refeições:', err?.message);
        const cached = getCacheData<Meal[]>(cacheKey);
        if (cached) {
          setState(s => ({ ...s, meals: cached }));
        } else {
          setState(s => ({ ...s, meals: [] }));
        }
      }
    };
    loadMeals();
  }, [user, state.selectedDate]);

  // ── FAVORITES ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const cacheKey = `nutritrack_favorites_${user.id}`;
    supabase.from('favorites').select('food_id').eq('user_id', user.id).then(({ data, error }) => {
      if (error) {
        console.error('Erro ao carregar favoritos:', error.message);
        const cached = getCacheData<string[]>(cacheKey);
        if (cached) setState(s => ({ ...s, favorites: cached }));
        return;
      }
      if (data) {
        const favIds = data.map(f => f.food_id);
        setCacheData(cacheKey, favIds);
        setState(s => ({ ...s, favorites: favIds }));
      }
    }).catch(() => {
      const cached = getCacheData<string[]>(cacheKey);
      if (cached) setState(s => ({ ...s, favorites: cached }));
    });
  }, [user]);

  // ── RECENT FOODS ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const cacheKey = `nutritrack_recent_foods_${user.id}`;
    supabase.from('recent_foods').select('food_id, quantidade').eq('user_id', user.id)
      .order('usado_em', { ascending: false }).limit(20).then(({ data, error }) => {
        if (error) {
          console.error('Erro ao carregar recentes:', error.message);
          const cached = getCacheData<{ recentFoods: string[]; recentFoodsWithQty: RecentFoodWithQty[] }>(cacheKey);
          if (cached) setState(s => ({ ...s, ...cached }));
          return;
        }
        if (data) {
          const recentFoods = data.map(f => f.food_id);
          const recentFoodsWithQty = data.map(f => ({ food_id: f.food_id, quantidade: (f as any).quantidade ?? 100 }));
          setCacheData(cacheKey, { recentFoods, recentFoodsWithQty });
          setState(s => ({ ...s, recentFoods, recentFoodsWithQty }));
        }
      }).catch(() => {
        const cached = getCacheData<{ recentFoods: string[]; recentFoodsWithQty: RecentFoodWithQty[] }>(cacheKey);
        if (cached) setState(s => ({ ...s, ...cached }));
      });
  }, [user]);

  // ── SET PROFILE ───────────────────────────────────────────────────────────
  const setProfile = useCallback((p: Partial<Profile>) => {
    // Atualização otimista primeiro
    let newProfile: Profile | null = null;
    setState(s => {
      newProfile = { ...s.profile, ...p };
      return { ...s, profile: newProfile };
    });
    // Supabase fora do setState
    if (user && newProfile) {
      const { id, user_id, created_at, updated_at, ...profileData } = newProfile as any;
      supabase.from('profiles').update(profileData).eq('user_id', user.id).then(({ error }) => {
        if (error) {
          toast.error('Erro ao salvar perfil');
          addPendingOperation('profiles', 'update', profileData, undefined, { user_id: user.id });
        }
      }).catch(() => {
        addPendingOperation('profiles', 'update', profileData, undefined, { user_id: user.id });
      });
    }
  }, [user]);

  const setSelectedDate = useCallback((d: string) => { setState(s => ({ ...s, selectedDate: d })); }, []);

  // ── ADD FOOD ──────────────────────────────────────────────────────────────
  const addFood = useCallback(async (f: Omit<Food, 'id'>): Promise<Food> => {
    try {
      const { data, error } = await supabase.from('foods').insert({ ...f, criado_por: user?.id }).select().single();
      if (error) throw error;
      const food = data as unknown as Food;
      setState(s => ({ ...s, foods: [...s.foods, food] }));
      return food;
    } catch (err: any) {
      toast.error('Erro ao criar alimento');
      throw err;
    }
  }, [user]);

  // ── UPDATE FOOD ───────────────────────────────────────────────────────────
  const updateFood = useCallback(async (id: string, updates: Partial<Omit<Food, 'id'>>) => {
    try {
      const { error } = await supabase.from('foods').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      setState(s => ({ ...s, foods: s.foods.map(f => f.id === id ? { ...f, ...updates } : f) }));
      toast.success('Alimento atualizado!');
    } catch (err: any) {
      console.error('[AppContext] Erro ao atualizar alimento:', err);
      toast.error('Erro ao atualizar alimento');
      throw err;
    }
  }, []);

  const searchFoodByBarcode = useCallback(async (code: string): Promise<Food | null> => {
    try {
      const { data, error } = await supabase.from('foods').select('*').eq('codigo_barras', code).maybeSingle();
      if (error) throw error;
      return data as unknown as Food | null;
    } catch (err: any) {
      toast.error('Erro ao buscar alimento por código de barras');
      return null;
    }
  }, []);

  // ── MEALS ─────────────────────────────────────────────────────────────────
  const addMeal = useCallback(async (m: Omit<Meal, 'id' | 'user_id'>): Promise<Meal> => {
    if (!user) throw new Error('Usuário não autenticado');
    const tempId = crypto.randomUUID();
    const mealPayload = { ...m, user_id: user.id };
    // Atualização otimista
    const optimisticMeal: Meal = { ...mealPayload, id: tempId, items: [] } as Meal;
    setState(s => ({ ...s, meals: [...s.meals, optimisticMeal] }));
    try {
      const { data, error } = await supabase.from('meals').insert(mealPayload).select().single();
      if (error) throw error;
      const meal: Meal = { ...data, tipo: data.tipo as any, items: [] };
      // Substitui o otimista pelo real
      setState(s => ({ ...s, meals: s.meals.map(existing => existing.id === tempId ? meal : existing) }));
      return meal;
    } catch (err: any) {
      // Enfileira para sync offline
      addPendingOperation('meals', 'upsert', { ...mealPayload, id: tempId }, 'id');
      return optimisticMeal;
    }
  }, [user]);

  const addMealItem = useCallback(async (mealId: string, item: Omit<MealItem, 'id' | 'meal_id'>) => {
    const { food, ...itemData } = item as any;
    const tempId = crypto.randomUUID();
    const insertPayload = { ...itemData, meal_id: mealId };
    // Atualização otimista
    const optimisticItem: MealItem = { ...insertPayload, id: tempId, food } as MealItem;
    setState(s => ({ ...s, meals: s.meals.map(m => m.id === mealId ? { ...m, items: [...(m.items || []), optimisticItem] } : m) }));
    try {
      const { data, error } = await supabase
        .from('meal_items')
        .insert(insertPayload)
        .select('*, food:foods(*)')
        .single();
      if (error) throw error;
      const newItem: MealItem = { ...data, food: data.food as unknown as Food } as MealItem;
      // Substitui otimista pelo real
      setState(s => ({ ...s, meals: s.meals.map(m => m.id === mealId ? { ...m, items: (m.items || []).map(i => i.id === tempId ? newItem : i) } : m) }));
    } catch (err: any) {
      // Enfileira para sync offline
      addPendingOperation('meal_items', 'upsert', { ...insertPayload, id: tempId }, 'id');
    }
  }, []);

  const updateMealItem = useCallback(async (
    mealId: string, itemId: string,
    updates: { quantidade: number; calorias_calculadas: number; proteina: number; carbo: number; gordura: number }
  ) => {
    // Atualização otimista
    setState(s => ({
      ...s, meals: s.meals.map(m => m.id === mealId ? {
        ...m, items: (m.items || []).map(i => i.id === itemId ? { ...i, ...updates } : i)
      } : m)
    }));
    try {
      const { error } = await supabase
        .from('meal_items')
        .update(updates)
        .eq('id', itemId)
        .eq('meal_id', mealId);
      if (error) throw error;
    } catch (err: any) {
      addPendingOperation('meal_items', 'update', updates, undefined, { id: itemId, meal_id: mealId });
    }
  }, []);

  const removeMealItem = useCallback(async (mealId: string, itemId: string) => {
    // Atualização otimista
    setState(s => ({ ...s, meals: s.meals.map(m => m.id === mealId ? { ...m, items: (m.items || []).filter(i => i.id !== itemId) } : m) }));
    try {
      const { error } = await supabase
        .from('meal_items')
        .delete()
        .eq('id', itemId)
        .eq('meal_id', mealId);
      if (error) throw error;
    } catch (err: any) {
      addPendingOperation('meal_items', 'delete', undefined, undefined, { id: itemId, meal_id: mealId });
    }
  }, []);

  const removeMeal = useCallback(async (mealId: string) => {
    if (!user) return;
    // Atualização otimista
    setState(s => ({ ...s, meals: s.meals.filter(m => m.id !== mealId) }));
    try {
      const { error } = await supabase
        .from('meals')
        .delete()
        .eq('id', mealId)
        .eq('user_id', user.id);
      if (error) throw error;
    } catch (err: any) {
      addPendingOperation('meals', 'delete', undefined, undefined, { id: mealId, user_id: user.id });
    }
  }, [user]);

  // ── TOGGLE FAVORITE ───────────────────────────────────────────────────────
  // CORREÇÃO: stale closure — lia state.favorites diretamente no callback
  // Agora lê dentro do setState para sempre ter o valor atual
  const toggleFavorite = useCallback(async (foodId: string) => {
    if (!user) return;
    // Lê estado atual e aplica otimista
    let wasFav = false;
    setState(s => {
      wasFav = s.favorites.includes(foodId);
      return {
        ...s,
        favorites: wasFav
          ? s.favorites.filter(f => f !== foodId)
          : [...s.favorites, foodId],
      };
    });
    // Supabase fora do setState
    try {
      if (wasFav) {
        const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('food_id', foodId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: user.id, food_id: foodId });
        if (error) throw error;
      }
    } catch {
      // Rollback otimista
      setState(s => ({
        ...s,
        favorites: wasFav
          ? [...s.favorites, foodId]
          : s.favorites.filter(f => f !== foodId),
      }));
      if (wasFav) {
        addPendingOperation('favorites', 'delete', undefined, undefined, { user_id: user.id, food_id: foodId });
      } else {
        addPendingOperation('favorites', 'insert', { user_id: user.id, food_id: foodId });
      }
    }
  }, [user]);

  // ── RECENT FOODS ──────────────────────────────────────────────────────────
  const addRecentFood = useCallback(async (foodId: string, quantidade: number = 100) => {
    if (!user) return;
    try {
      // Upsert único em vez de select+insert/update separados (evita race condition)
      const { error: upsertError } = await supabase
        .from('recent_foods')
        .upsert(
          { user_id: user.id, food_id: foodId, quantidade, usado_em: new Date().toISOString() } as any,
          { onConflict: 'user_id,food_id' }
        );
      if (upsertError) throw upsertError;

      // Cleanup: mantém apenas os 20 mais recentes + atualiza estado
      const { data: freshRecents, error: freshError } = await supabase
        .from('recent_foods').select('id, food_id, quantidade').eq('user_id', user.id)
        .order('usado_em', { ascending: false }).limit(30);
      if (freshError) throw freshError;
      if (freshRecents && freshRecents.length > 20) {
        const idsToDelete = freshRecents.slice(20).map(r => r.id);
        await supabase.from('recent_foods').delete().in('id', idsToDelete);
      }
      if (freshRecents) {
        const top20 = freshRecents.slice(0, 20);
        setState(s => ({
          ...s,
          recentFoods: top20.map(f => f.food_id),
          recentFoodsWithQty: top20.map(f => ({ food_id: f.food_id, quantidade: (f as any).quantidade ?? 100 })),
        }));
      }
    } catch (err: any) {
      console.error('Erro ao adicionar recente:', err?.message);
    }
  }, [user]);

  const refreshRecentFoods = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('recent_foods').select('food_id, quantidade').eq('user_id', user.id)
        .order('usado_em', { ascending: false }).limit(20);
      if (error) throw error;
      if (data) setState(s => ({
        ...s,
        recentFoods: data.map(f => f.food_id),
        recentFoodsWithQty: data.map(f => ({ food_id: f.food_id, quantidade: (f as any).quantidade ?? 100 })),
      }));
    } catch (err: any) {
      console.error('Erro ao atualizar recentes:', err?.message);
    }
  }, [user]);

  // ── RECIPES ───────────────────────────────────────────────────────────────
  const loadRecipes = useCallback(async () => {
    if (!user) return;
    const cacheKey = `nutritrack_recipes_${user.id}`;
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*, items:recipe_items(*, food:foods(*))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const recipes: Recipe[] = data.map(r => ({
          ...r,
          items: ((r as any).items || []).map((i: any) => ({
            ...i, food: i.food as unknown as Food,
          })) as RecipeItem[],
        }));
        setCacheData(cacheKey, recipes);
        setState(s => ({ ...s, recipes }));
      }
    } catch (err: any) {
      console.error('Erro ao carregar receitas:', err?.message);
      const cached = getCacheData<Recipe[]>(cacheKey);
      if (cached) {
        setState(s => ({ ...s, recipes: cached }));
      } else {
        toast.error('Erro ao carregar receitas');
      }
    }
  }, [user]);

  const createRecipe = useCallback(async (nome: string, descricao: string, itens: { food_id: string; quantidade: number }[]) => {
    if (!user) return;
    try {
      const { data: recipe, error } = await supabase
        .from('recipes').insert({ user_id: user.id, nome, descricao: descricao || null }).select().single();
      if (error) throw error;
      if (!recipe) return;
      if (itens.length > 0) {
        const { error: itemsErr } = await supabase.from('recipe_items').insert(
          itens.map(i => ({ recipe_id: recipe.id, food_id: i.food_id, quantidade: i.quantidade }))
        );
        if (itemsErr) throw itemsErr;
      }
      toast.success('Receita criada!');
      await loadRecipes();
    } catch (err: any) {
      toast.error('Erro ao criar receita');
    }
  }, [user, loadRecipes]);

  const updateRecipe = useCallback(async (recipeId: string, nome: string, descricao: string, itens: { food_id: string; quantidade: number }[]) => {
    if (!user) return;
    try {
      const { error: updErr } = await supabase
        .from('recipes')
        .update({ nome, descricao: descricao || null, updated_at: new Date().toISOString() })
        .eq('id', recipeId)
        .eq('user_id', user.id); // segurança: garante ownership
      if (updErr) throw updErr;
      const { error: delErr } = await supabase.from('recipe_items').delete().eq('recipe_id', recipeId);
      if (delErr) throw delErr;
      if (itens.length > 0) {
        const { error: insErr } = await supabase.from('recipe_items').insert(
          itens.map(i => ({ recipe_id: recipeId, food_id: i.food_id, quantidade: i.quantidade }))
        );
        if (insErr) throw insErr;
      }
      toast.success('Receita atualizada!');
      await loadRecipes();
    } catch (err: any) {
      toast.error('Erro ao atualizar receita');
    }
  }, [user, loadRecipes]);

  const deleteRecipe = useCallback(async (recipeId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId)
        .eq('user_id', user.id);
      if (error) throw error;
      setState(s => ({ ...s, recipes: s.recipes.filter(r => r.id !== recipeId) }));
    } catch (err: any) {
      toast.error('Erro ao excluir receita');
    }
  }, [user]);

  const addRecipeToMeal = useCallback(async (recipe: Recipe, mealId: string) => {
    if (!recipe.items || recipe.items.length === 0) return;
    for (const item of recipe.items) {
      if (!item.food) continue;
      const factor = item.quantidade / 100;
      const insertData = {
        meal_id: mealId,
        food_id: item.food_id,
        quantidade: item.quantidade,
        calorias_calculadas: item.food.calorias_por_100 * factor,
        proteina: item.food.proteina_por_100 * factor,
        carbo: item.food.carbo_por_100 * factor,
        gordura: item.food.gordura_por_100 * factor,
      };
      try {
        const { data, error } = await supabase.from('meal_items').insert(insertData).select('*, food:foods(*)').single();
        if (error) throw error;
        if (data) {
          const newItem: MealItem = { ...data, food: data.food as unknown as Food } as MealItem;
          setState(s => ({ ...s, meals: s.meals.map(m => m.id === mealId ? { ...m, items: [...(m.items || []), newItem] } : m) }));
        }
        await addRecentFood(item.food_id, item.quantidade);
      } catch (err: any) {
        toast.error(`Erro ao adicionar ${item.food.nome} da receita`);
      }
    }
  }, [addRecentFood, user]);

  // ── DERIVED STATE ─────────────────────────────────────────────────────────
  const getMealsForDate = useCallback((date: string) => state.meals.filter(m => m.data === date), [state.meals]);

  const getDaySummary = useCallback((date: string) => {
    const meals = state.meals.filter(m => m.data === date);
    return meals.reduce((acc, meal) => {
      (meal.items || []).forEach(item => {
        acc.calorias += item.calorias_calculadas;
        acc.proteina += item.proteina;
        acc.carbo += item.carbo;
        acc.gordura += item.gordura;
      });
      return acc;
    }, { calorias: 0, proteina: 0, carbo: 0, gordura: 0 });
  }, [state.meals]);

  const getMetaCalorica = useCallback(() => calcularMetaCalorica(state.profile), [state.profile]);
  const getMacroMetas = useCallback(() => {
    const { metaFinal } = calcularMetaCalorica(state.profile);
    return calcularMacros(state.profile, metaFinal);
  }, [state.profile]);

  return (
    <AppContext.Provider value={{
      ...state, setProfile, setSelectedDate, addFood, updateFood, addMeal, addMealItem,
      updateMealItem, removeMealItem, removeMeal, toggleFavorite, addRecentFood,
      refreshRecentFoods, getMealsForDate,
      getDaySummary, getMetaCalorica, getMacroMetas, refreshFoods, searchFoodByBarcode,
      loadRecipes, createRecipe, updateRecipe, deleteRecipe, addRecipeToMeal,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
