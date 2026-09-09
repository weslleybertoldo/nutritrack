import React, { useState, useMemo } from 'react';
import { MealItem } from '@/types';
import { useApp } from '@/context/AppContext';
import { Trash2, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BottomSheet } from '@/components/ui/bottom-sheet';

interface EditMealItemModalProps {
  item: MealItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (quantidade: number, macros: { calorias_calculadas: number; proteina: number; carbo: number; gordura: number }) => void;
  onRemove: () => void;
}

export default function EditMealItemModal({ item, open, onOpenChange, onSave, onRemove }: EditMealItemModalProps) {
  const { favorites, toggleFavorite } = useApp();
  const [quantidadeStr, setQuantidadeStr] = useState(String(item.quantidade));
  const food = item.food;
  const isFav = food ? favorites.includes(food.id) : false;

  const quantidadeNum = quantidadeStr === '' ? 0 : parseFloat(quantidadeStr) || 0;

  const macros = useMemo(() => {
    if (!food) return { calorias: 0, proteina: 0, carbo: 0, gordura: 0 };
    const f = quantidadeNum / 100;
    return {
      calorias: food.calorias_por_100 * f,
      proteina: food.proteina_por_100 * f,
      carbo: food.carbo_por_100 * f,
      gordura: food.gordura_por_100 * f,
    };
  }, [food, quantidadeNum]);

  const handleSave = () => {
    if (quantidadeNum <= 0) return;
    onSave(quantidadeNum, {
      calorias_calculadas: macros.calorias,
      proteina: macros.proteina,
      carbo: macros.carbo,
      gordura: macros.gordura,
    });
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Item"
      description="Ajuste a quantidade do alimento nesta refeição"
      footer={
        <div className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex gap-2">
          <Button variant="destructive" className="flex-shrink-0" onClick={onRemove}>
            <Trash2 className="h-4 w-4 mr-1" /> Remover
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={quantidadeNum <= 0}>
            Salvar
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-body font-medium text-sm flex-1 truncate">{food?.nome || 'Alimento'}</p>
          {food && (
            <button
              type="button"
              onClick={() => toggleFavorite(food.id)}
              aria-label={isFav ? 'Remover dos favoritos' : 'Favoritar'}
              className={`pressable-sm p-2 rounded-full shrink-0 ${isFav ? 'text-destructive' : 'text-muted-foreground hover:text-destructive/70'}`}
            >
              <Heart className="h-5 w-5" fill={isFav ? 'currentColor' : 'none'} />
            </button>
          )}
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
            <span className="text-xs text-muted-foreground">{food?.unidade || 'g'}</span>
          </div>
          <Slider
            value={[quantidadeNum || 10]}
            onValueChange={([v]) => setQuantidadeStr(String(v))}
            min={10}
            max={Math.max(500, Math.ceil(quantidadeNum * 1.5 / 10) * 10)}
            step={5}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {([
            { label: 'Calorias', value: `${Math.round(macros.calorias)}`, unit: 'kcal' },
            { label: 'Proteína', value: `${Math.round(macros.proteina)}`, unit: 'g' },
            { label: 'Carbo', value: `${Math.round(macros.carbo)}`, unit: 'g' },
            { label: 'Gordura', value: `${Math.round(macros.gordura)}`, unit: 'g' },
          ]).map(m => (
            <div key={m.label} className="rounded-lg border border-border bg-secondary/50 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
              <p className="font-heading font-bold text-sm">{m.value}<span className="text-[10px] font-normal text-muted-foreground">{m.unit}</span></p>
            </div>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
