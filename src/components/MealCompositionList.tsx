import type { MealComposition } from '@/lib/mealComposition';

interface Props {
  rows: MealComposition[];
  /** Semana: mostra em quantos dias a refeição teve registro. */
  showDays?: boolean;
  emptyText?: string;
}

const MACROS = [
  { key: 'proteina', label: 'Proteína', text: 'text-primary', bg: 'bg-primary' },
  { key: 'carbo', label: 'Carbo', text: 'text-classify-blue', bg: 'bg-classify-blue' },
  { key: 'gordura', label: 'Gordura', text: 'text-caution', bg: 'bg-caution' },
] as const;

/**
 * Sub-aba "Refeições" do Resumo Nutricional: composição de cada refeição —
 * gramas de P/C/G e a participação (%) de cada macro nas calorias daquela
 * refeição. Ex.: só proteína → 100% proteína.
 */
export default function MealCompositionList({ rows, showDays, emptyText }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground font-body">
        {emptyText ?? 'Nenhuma refeição com alimentos registrados.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground font-body">
        % = participação de cada macro nas calorias da refeição (proteína e carbo 4 kcal/g, gordura 9 kcal/g).
      </p>
      {rows.map(r => (
        <div key={r.key} className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-secondary/40">
            <div className="min-w-0">
              <p className="font-heading text-sm uppercase tracking-wide truncate">{r.label}</p>
              <p className="text-[11px] text-muted-foreground font-body">
                {r.itemCount} alimento{r.itemCount === 1 ? '' : 's'}
                {showDays && r.days ? ` · ${r.days} dia${r.days === 1 ? '' : 's'}` : ''}
              </p>
            </div>
            <p className="font-heading font-bold text-sm text-brand shrink-0">
              {Math.round(r.totals.calorias)} <span className="text-[10px] font-normal text-muted-foreground">kcal</span>
            </p>
          </div>

          {/* Barra empilhada: proporção de cada macro */}
          <div className="flex h-1.5 w-full bg-muted" aria-hidden>
            {MACROS.map(m => (
              <div
                key={m.key}
                className={`${m.bg} transition-[width] duration-300 ease-out`}
                style={{ width: `${r.pct[m.key]}%` }}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 divide-x divide-border text-center">
            {MACROS.map(m => (
              <div key={m.key} className="px-2 py-2">
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
                <p className={`font-heading font-bold text-sm ${m.text}`}>{r.pct[m.key]}%</p>
                <p className="text-[11px] text-muted-foreground font-body">{Math.round(r.totals[m.key])}g</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
