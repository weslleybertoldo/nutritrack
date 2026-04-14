import React, { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Food, Unidade } from '@/types';
import { Button } from '@/components/ui/button';
import { Camera, ScanBarcode, Loader2, Heart } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateFoodFormProps {
  onCreated: (food: Food) => void;
  initialBarcode?: string;
  onExistingFood?: (food: Food) => void;
}

export default function CreateFoodForm({ onCreated, initialBarcode, onExistingFood }: CreateFoodFormProps) {
  const { addFood, searchFoodByBarcode, toggleFavorite } = useApp();
  const [addToFavorites, setAddToFavorites] = useState(false);
  const [porcaoRef, setPorcaoRef] = useState(100);
  const [form, setForm] = useState({
    nome: '',
    codigo_barras: initialBarcode || '',
    unidade: 'g' as Unidade,
    calorias: '',
    proteina: '',
    carbo: '',
    gordura: '',
    acucares: '',
    gordura_saturada: '',
    gordura_trans: '',
    fibras: '',
    sodio: '',
    colesterol: '',
    potassio: '',
  });
  const [showScanner, setShowScanner] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Convert a value from the entered portion to per-100 units
  const toPer100 = (val: string) => {
    const n = Number(val) || 0;
    if (porcaoRef <= 0) return 0;
    return Math.round((n / porcaoRef) * 100 * 100) / 100;
  };

  const handleBarcodeScanned = async (code: string) => {
    setShowScanner(false);
    set('codigo_barras', code);
    const existing = await searchFoodByBarcode(code);
    if (existing) {
      toast.info(`Alimento "${existing.nome}" já cadastrado com este código.`, {
        action: onExistingFood ? {
          label: 'Abrir alimento',
          onClick: () => onExistingFood(existing),
        } : undefined,
      });
    }
  };

  const handlePhotoExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    try {
      // Comprime a imagem para no máximo 800px e qualidade 0.6
      // Fotos de celular chegam a 3MB+ — Gemini rejeita payloads grandes
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const MAX = 800;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl.split(',')[1]);
        };
        img.onerror = reject;
        img.src = url;
      });

      // Garante token fresco antes de chamar Edge Function (JWT expira em 1h)
      const { data: { session } } = await supabase.auth.refreshSession();
      const token = session?.access_token;
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      // Fetch direto (não usa SDK invoke que esconde erros)
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-nutrition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        const detail = data?.error || `HTTP ${res.status}`;
        console.error('[PhotoExtract] status:', res.status, 'body:', data);
        toast.error(`Erro ao ler tabela: ${detail}`);
        return;
      }

      const d = data.data;
      // Photo extraction returns per-100 values; convert to current portion
      const fromPer100 = (v: number | null | undefined) => {
        if (v == null) return undefined;
        if (porcaoRef <= 0) return String(v);
        return String(Math.round((v / 100) * porcaoRef * 100) / 100);
      };

      setForm(f => ({
        ...f,
        nome: d.nome || f.nome,
        calorias: fromPer100(d.calorias_por_100) ?? f.calorias,
        proteina: fromPer100(d.proteina_por_100) ?? f.proteina,
        carbo: fromPer100(d.carbo_por_100) ?? f.carbo,
        acucares: fromPer100(d.acucares_por_100) ?? f.acucares,
        gordura: fromPer100(d.gordura_por_100) ?? f.gordura,
        gordura_saturada: fromPer100(d.gordura_saturada_por_100) ?? f.gordura_saturada,
        gordura_trans: fromPer100(d.gordura_trans_por_100) ?? f.gordura_trans,
        fibras: fromPer100(d.fibras_por_100) ?? f.fibras,
        sodio: fromPer100(d.sodio_por_100) ?? f.sodio,
        colesterol: fromPer100(d.colesterol_por_100) ?? f.colesterol,
        potassio: fromPer100(d.potassio_por_100) ?? f.potassio,
      }));
      toast.success('Dados extraídos com sucesso!');
    } catch (err: any) {
      console.error('[PhotoExtract] catch:', err);
      toast.error(`Erro na extração: ${err?.message || 'erro desconhecido'}`);
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.calorias) return;
    try {
      const food = await addFood({
        nome: form.nome.trim(),
        codigo_barras: form.codigo_barras || undefined,
        unidade: form.unidade,
        calorias_por_100: toPer100(form.calorias),
        proteina_por_100: toPer100(form.proteina),
        carbo_por_100: toPer100(form.carbo),
        gordura_por_100: toPer100(form.gordura),
        acucares_por_100: toPer100(form.acucares),
        gordura_saturada_por_100: toPer100(form.gordura_saturada),
        gordura_trans_por_100: toPer100(form.gordura_trans),
        fibras_por_100: toPer100(form.fibras),
        sodio_por_100: toPer100(form.sodio),
        colesterol_por_100: toPer100(form.colesterol),
        potassio_por_100: toPer100(form.potassio),
      });
      if (addToFavorites) {
        await toggleFavorite(food.id);
      }
      onCreated(food);
    } catch (e) {
      console.error('[CreateFoodForm] Erro ao criar alimento:', e);
      toast.error('Erro ao criar alimento. Tente novamente.');
    }
  };

  const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-xs text-muted-foreground mb-1 block";

  if (showScanner) {
    return <BarcodeScanner onScanned={handleBarcodeScanned} onClose={() => setShowScanner(false)} />;
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* Content */}
      <div className="space-y-4 pb-4">
        {/* Photo extract button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoExtract}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={extracting}
        >
          {extracting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando tabela nutricional...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              📷 Preencher com foto
            </>
          )}
        </Button>

        <div>
          <label className={labelClass}>Nome *</label>
          <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} className={inputClass} placeholder="Ex: Arroz integral" required />
        </div>
        <div>
          <label className={labelClass}>Código de barras (opcional)</label>
          <div className="flex gap-2">
            <input type="text" value={form.codigo_barras} onChange={e => set('codigo_barras', e.target.value)} className={inputClass} />
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="flex items-center justify-center rounded-lg border border-input bg-background px-3 hover:bg-secondary transition-colors"
              title="Escanear código de barras"
            >
              <ScanBarcode className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Portion reference + unit */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className={labelClass}>Porção de referência</label>
            <input
              type="number"
              value={porcaoRef}
              onChange={e => setPorcaoRef(Math.max(1, Number(e.target.value)))}
              className={inputClass}
              min={1}
            />
          </div>
          <div className="flex-1">
            <label className={labelClass}>Unidade</label>
            <select value={form.unidade} onChange={e => set('unidade', e.target.value)} className={inputClass}>
              <option value="g">Gramas (g)</option>
              <option value="ml">Mililitros (ml)</option>
            </select>
          </div>
        </div>

        <h3 className="font-heading font-semibold text-sm pt-2">
          Valores por {porcaoRef}{form.unidade}
          {porcaoRef !== 100 && (
            <span className="text-xs font-normal text-muted-foreground ml-2">(convertido p/ 100{form.unidade} ao salvar)</span>
          )}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Calorias (kcal) *</label>
            <input type="number" value={form.calorias} onChange={e => set('calorias', e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Proteínas (g)</label>
            <input type="number" value={form.proteina} onChange={e => set('proteina', e.target.value)} className={inputClass} step="0.1" />
          </div>
          <div>
            <label className={labelClass}>Carboidratos (g)</label>
            <input type="number" value={form.carbo} onChange={e => set('carbo', e.target.value)} className={inputClass} step="0.1" />
          </div>
          <div>
            <label className={labelClass}>Açúcares (g)</label>
            <input type="number" value={form.acucares} onChange={e => set('acucares', e.target.value)} className={inputClass} step="0.1" />
          </div>
          <div>
            <label className={labelClass}>Gorduras totais (g)</label>
            <input type="number" value={form.gordura} onChange={e => set('gordura', e.target.value)} className={inputClass} step="0.1" />
          </div>
          <div>
            <label className={labelClass}>Gord. saturadas (g)</label>
            <input type="number" value={form.gordura_saturada} onChange={e => set('gordura_saturada', e.target.value)} className={inputClass} step="0.1" />
          </div>
          <div>
            <label className={labelClass}>Gord. trans (g)</label>
            <input type="number" value={form.gordura_trans} onChange={e => set('gordura_trans', e.target.value)} className={inputClass} step="0.1" />
          </div>
          <div>
            <label className={labelClass}>Fibras (g)</label>
            <input type="number" value={form.fibras} onChange={e => set('fibras', e.target.value)} className={inputClass} step="0.1" />
          </div>
          <div>
            <label className={labelClass}>Sódio (mg)</label>
            <input type="number" value={form.sodio} onChange={e => set('sodio', e.target.value)} className={inputClass} step="0.1" />
          </div>
          <div>
            <label className={labelClass}>Colesterol (mg)</label>
            <input type="number" value={form.colesterol} onChange={e => set('colesterol', e.target.value)} className={inputClass} step="0.1" />
          </div>
          <div>
            <label className={labelClass}>Potássio (mg)</label>
            <input type="number" value={form.potassio} onChange={e => set('potassio', e.target.value)} className={inputClass} step="0.1" />
          </div>
        </div>
      </div>

      {/* Favorite toggle */}
      <button
        type="button"
        onClick={() => setAddToFavorites(!addToFavorites)}
        className={`flex items-center gap-2 w-full rounded-lg border px-3 py-2.5 text-sm font-body transition-colors ${
          addToFavorites ? 'border-destructive/50 bg-destructive/5 text-destructive' : 'border-input hover:bg-secondary'
        }`}
      >
        <Heart className="h-4 w-4" fill={addToFavorites ? 'currentColor' : 'none'} />
        Adicionar aos favoritos
      </button>

      {/* Save button */}
      <div className="sticky bottom-0 bg-card pt-3 pb-safe border-t border-border">
        <Button type="submit" className="w-full" size="lg">Salvar Alimento</Button>
      </div>
    </form>
  );
}
