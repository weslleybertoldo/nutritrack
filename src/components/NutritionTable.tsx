import React from 'react';
import { Food } from '@/types';

interface NutritionTableProps {
  food: Food;
  quantidade: number;
}

export default function NutritionTable({ food, quantidade }: NutritionTableProps) {
  const factor = quantidade / 100;

  const rows = [
    { label: 'Calorias', value: Math.round(food.calorias_por_100 * factor), unit: 'kcal' },
    { label: 'Proteínas', value: (food.proteina_por_100 * factor).toFixed(1), unit: 'g' },
    { label: 'Carboidratos', value: (food.carbo_por_100 * factor).toFixed(1), unit: 'g' },
    { label: '  dos quais Açúcares', value: (food.acucares_por_100 * factor).toFixed(1), unit: 'g', indent: true },
    { label: 'Gorduras totais', value: (food.gordura_por_100 * factor).toFixed(1), unit: 'g' },
    { label: '  Gordura saturada', value: (food.gordura_saturada_por_100 * factor).toFixed(1), unit: 'g', indent: true },
    { label: '  Gordura trans', value: (food.gordura_trans_por_100 * factor).toFixed(1), unit: 'g', indent: true },
    { label: 'Fibras', value: (food.fibras_por_100 * factor).toFixed(1), unit: 'g' },
    { label: 'Sódio', value: (food.sodio_por_100 * factor).toFixed(1), unit: 'mg' },
    { label: 'Colesterol', value: (food.colesterol_por_100 * factor).toFixed(1), unit: 'mg' },
    { label: 'Potássio', value: (food.potassio_por_100 * factor).toFixed(1), unit: 'mg' },
  ];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 bg-secondary/50 border-b border-border">
        <p className="font-heading font-semibold text-sm">Informação Nutricional</p>
        <p className="text-xs text-muted-foreground">Para {quantidade}{food.unidade}</p>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-3 py-1.5 text-sm font-body ${
              row.indent ? 'pl-6 text-muted-foreground' : ''
            } ${i === 0 ? 'font-semibold' : ''}`}
          >
            <span>{row.label}</span>
            <span className="font-medium">{row.value} {row.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
