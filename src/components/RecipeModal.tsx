import React, { useState, useMemo } from 'react';
import { Food, Recipe, RecipeItem } from '@/types';
import { X, Search, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecipeItemDraft {
  food_id: string;
  food: Food;
  quantidade: number;
  quantidadeStr: string;
}

interface RecipeModalProps {
  recipe: Recipe | null;
  foods: Food[];
  onSave: (nome: string, descricao: string, itens: { food_id: string; quantidade: number }[]) => Promise<void>;
  onClose: () => void;
}

export default function RecipeModal({ recipe, foods, onSave, onClose }: RecipeModalProps) {
  const [nome, setNome] = useState(recipe?.nome || '');
  const [descricao, setDescricao] = useState(recipe?.descricao || '');
  const [itens, setItens] = useState<RecipeItemDraft[]>(() => {
    if (recipe?.items) {
      return recipe.items.filter(i => i.food).map(i => ({
        food_id: i.food_id,
        food: i.food!,
        quantidade: i.quantidade,
        quantidadeStr: String(i.quantidade),
      }));
    }
    return [];
  });
  const [busca, setBusca] = useState('');
  const [saving, setSaving] = useState(false);

  const resultados = useMemo(() => {
    if (busca.length < 2) return [];
    const q = busca.toLowerCase();
    return foods.filter(f => f.nome.toLowerCase().includes(q)).slice(0, 10);
  }, [foods, busca]);

  const totais = useMemo(() => {
    return itens.reduce((acc, item) => {
      const qty = parseFloat(item.quantidadeStr) || 0;
      const f = qty / 100;
      return {
        calorias: acc.calorias + item.food.calorias_por_100 * f,
        proteina: acc.proteina + item.food.proteina_por_100 * f,
        carbo: acc.carbo + item.food.carbo_por_100 * f,
        gordura: acc.gordura + item.food.gordura_por_100 * f,
      };
    }, { calorias: 0, proteina: 0, carbo: 0, gordura: 0 });
  }, [itens]);

  const addItem = (food: Food) => {
    setItens(prev => [...prev, { food_id: food.id, food, quantidade: 100, quantidadeStr: '100' }]);
    setBusca('');
  };

  const removeItem = (index: number) => {
    setItens(prev => prev.filter((_, i) => i !== index));
  };

  const updateQty = (index: number, val: string) => {
    setItens(prev => prev.map((item, i) =>
      i === index ? { ...item, quantidadeStr: val, quantidade: parseFloat(val) || 0 } : item
    ));
  };

  const handleSave = async () => {
    if (!nome.trim() || itens.length === 0) return;
    setSaving(true);
    try {
      await onSave(
        nome.trim(),
        descricao.trim(),
        itens.map(i => ({ food_id: i.food_id, quantidade: parseFloat(i.quantidadeStr) || 100 }))
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl bg-card animate-slide-up flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <h2 className="font-heading font-semibold">{recipe ? 'Editar Receita' : 'Nova Receita'}</h2>
          <button onClick={onClose} className="p-1"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bottom-sheet-content">
          {/* Nome */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Almoço, Pré-treino..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Descrição (opcional)</label>
            <input
              type="text"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Descrição breve..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Buscar alimento */}
          <div className="relative">
            <label className="text-xs text-muted-foreground mb-1 block">Adicionar alimento</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar alimento..."
                className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {resultados.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
                {resultados.map(food => (
                  <button
                    key={food.id}
                    className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
                    onClick={() => addItem(food)}
                  >
                    <p className="text-sm font-body truncate">{food.nome}</p>
                    <p className="text-xs text-muted-foreground">{food.calorias_por_100} kcal/100{food.unidade}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Itens */}
          {itens.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Alimentos na receita:</p>
              {itens.map((item, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body truncate">{item.food.nome}</p>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.quantidadeStr}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d*[.,]?\d*$/.test(val)) updateQty(i, val);
                    }}
                    onBlur={() => {
                      const num = parseFloat(item.quantidadeStr);
                      if (!num || num < 0.1) updateQty(i, '100');
                    }}
                    onFocus={e => e.target.select()}
                    className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm text-center font-body focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">{item.food.unidade}</span>
                  <button onClick={() => removeItem(i)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {/* Totais */}
              <div className="grid grid-cols-4 gap-2 pt-2">
                {([
                  { label: 'Calorias', value: Math.round(totais.calorias), unit: 'kcal' },
                  { label: 'Proteína', value: Math.round(totais.proteina), unit: 'g' },
                  { label: 'Carbo', value: Math.round(totais.carbo), unit: 'g' },
                  { label: 'Gordura', value: Math.round(totais.gordura), unit: 'g' },
                ]).map(m => (
                  <div key={m.label} className="rounded-lg border border-border bg-secondary/50 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    <p className="font-heading font-bold text-sm">{m.value}<span className="text-[10px] font-normal text-muted-foreground">{m.unit}</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="shrink-0 border-t border-border bg-card p-4 pb-safe">
          <Button
            className="w-full"
            size="lg"
            onClick={handleSave}
            disabled={!nome.trim() || itens.length === 0 || saving}
          >
            {saving ? 'Salvando...' : recipe ? 'Salvar Alterações' : 'Criar Receita'}
          </Button>
        </div>
      </div>
    </div>
  );
}
