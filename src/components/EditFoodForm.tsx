import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Food, Unidade } from '@/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface EditFoodFormProps {
  food: Food;
  onSaved: (updatedFood: Food) => void;
  onCancel: () => void;
}

export default function EditFoodForm({ food, onSaved, onCancel }: EditFoodFormProps) {
  const { updateFood } = useApp();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: food.nome,
    codigo_barras: food.codigo_barras || '',
    unidade: food.unidade,
    calorias: String(food.calorias_por_100),
    proteina: String(food.proteina_por_100),
    carbo: String(food.carbo_por_100),
    gordura: String(food.gordura_por_100),
    acucares: String(food.acucares_por_100),
    gordura_saturada: String(food.gordura_saturada_por_100),
    gordura_trans: String(food.gordura_trans_por_100),
    fibras: String(food.fibras_por_100),
    sodio: String(food.sodio_por_100),
    colesterol: String(food.colesterol_por_100),
    potassio: String(food.potassio_por_100),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.calorias) return;
    setSaving(true);
    try {
      const updates: Partial<Omit<Food, 'id'>> = {
        nome: form.nome.trim(),
        codigo_barras: form.codigo_barras || undefined,
        unidade: form.unidade,
        calorias_por_100: parseFloat(form.calorias) || 0,
        proteina_por_100: parseFloat(form.proteina) || 0,
        carbo_por_100: parseFloat(form.carbo) || 0,
        gordura_por_100: parseFloat(form.gordura) || 0,
        acucares_por_100: parseFloat(form.acucares) || 0,
        gordura_saturada_por_100: parseFloat(form.gordura_saturada) || 0,
        gordura_trans_por_100: parseFloat(form.gordura_trans) || 0,
        fibras_por_100: parseFloat(form.fibras) || 0,
        sodio_por_100: parseFloat(form.sodio) || 0,
        colesterol_por_100: parseFloat(form.colesterol) || 0,
        potassio_por_100: parseFloat(form.potassio) || 0,
      };
      await updateFood(food.id, updates);
      onSaved({ ...food, ...updates } as Food);
    } catch (e) {
      console.error('[EditFoodForm] Erro ao salvar:', e);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-xs text-muted-foreground mb-1 block";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={labelClass}>Nome *</label>
        <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} className={inputClass} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Código de barras</label>
          <input type="text" value={form.codigo_barras} onChange={e => set('codigo_barras', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Unidade</label>
          <select value={form.unidade} onChange={e => set('unidade', e.target.value)} className={inputClass}>
            <option value="g">g (gramas)</option>
            <option value="ml">ml (mililitros)</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-heading uppercase tracking-wider pt-1">Macronutrientes (por 100{form.unidade})</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Calorias (kcal) *</label>
          <input type="number" inputMode="decimal" value={form.calorias} onChange={e => set('calorias', e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>Proteínas (g)</label>
          <input type="number" inputMode="decimal" value={form.proteina} onChange={e => set('proteina', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Carboidratos (g)</label>
          <input type="number" inputMode="decimal" value={form.carbo} onChange={e => set('carbo', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Gorduras (g)</label>
          <input type="number" inputMode="decimal" value={form.gordura} onChange={e => set('gordura', e.target.value)} className={inputClass} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-heading uppercase tracking-wider pt-1">Micronutrientes (por 100{form.unidade})</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Açúcares (g)</label>
          <input type="number" inputMode="decimal" value={form.acucares} onChange={e => set('acucares', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Gordura saturada (g)</label>
          <input type="number" inputMode="decimal" value={form.gordura_saturada} onChange={e => set('gordura_saturada', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Gordura trans (g)</label>
          <input type="number" inputMode="decimal" value={form.gordura_trans} onChange={e => set('gordura_trans', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Fibras (g)</label>
          <input type="number" inputMode="decimal" value={form.fibras} onChange={e => set('fibras', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Sódio (mg)</label>
          <input type="number" inputMode="decimal" value={form.sodio} onChange={e => set('sodio', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Colesterol (mg)</label>
          <input type="number" inputMode="decimal" value={form.colesterol} onChange={e => set('colesterol', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Potássio (mg)</label>
          <input type="number" inputMode="decimal" value={form.potassio} onChange={e => set('potassio', e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1" disabled={saving || !form.nome.trim() || !form.calorias}>
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
