import React from 'react';
import AppLayout from '@/components/AppLayout';
import { useApp } from '@/context/AppContext';
import { NIVEL_ATIVIDADE_OPTIONS, Objetivo, TmbMetodo } from '@/types';
import { calcularMetaCalorica, calcularMacros } from '@/lib/calculations';

export default function GoalsPage() {
  const { profile, setProfile } = useApp();
  const isLocked = profile.admin_locked === true;
  const meta = calcularMetaCalorica(profile);
  const macros = calcularMacros(profile, meta.metaFinal);

  const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring";
  const readOnlyClass = "w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm font-body text-muted-foreground";
  const labelClass = "text-xs text-muted-foreground mb-1 block font-body";

  // Warnings
  const getAjusteWarning = () => {
    const aj = profile.ajuste_calorico;
    if (profile.objetivo === 'manter' && aj > 0) return `⚠️ Você está consumindo ${aj} kcal acima da sua meta de manutenção. Com isso, tende a ganhar peso.`;
    if (profile.objetivo === 'manter' && aj < 0) return `⚠️ Você está consumindo ${Math.abs(aj)} kcal abaixo da sua meta de manutenção. Com isso, tende a perder peso.`;
    if (profile.objetivo === 'perder' && aj > 0) return '⚠️ Atenção: o ajuste positivo pode comprometer seu déficit calórico.';
    if (profile.objetivo === 'ganhar' && aj < 0) return '⚠️ O ajuste negativo pode reduzir seu superávit calórico.';
    return null;
  };

  const warning = getAjusteWarning();

  return (
    <AppLayout title="Minha Meta">
      <div className="space-y-6 pb-8">
        {isLocked && (
          <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground font-body">
            🔒 Metas bloqueadas pelo administrador. Apenas o ajuste manual (Passo 3) está disponível.
          </div>
        )}

        {/* Step 1: Objective */}
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-base">Passo 1 — Objetivo</h2>
          {isLocked ? (
            <div className={readOnlyClass}>
              {profile.objetivo === 'perder' ? '🔴 Perder peso' : profile.objetivo === 'ganhar' ? '🟢 Ganhar peso' : '🟡 Manter'}
            </div>
          ) : (
            <div className="flex gap-2">
              {([
                { value: 'perder' as Objetivo, label: 'Perder peso', icon: '🔴' },
                { value: 'manter' as Objetivo, label: 'Manter', icon: '🟡' },
                { value: 'ganhar' as Objetivo, label: 'Ganhar peso', icon: '🟢' },
              ]).map(o => (
                <button
                  key={o.value}
                  className={`flex-1 rounded-lg border py-3 text-center text-sm font-body transition-colors ${
                    profile.objetivo === o.value ? 'border-primary bg-primary/10 font-medium' : 'border-input hover:bg-secondary'
                  }`}
                  onClick={() => setProfile({ objetivo: o.value })}
                >
                  <span className="block text-lg">{o.icon}</span>
                  <span className="text-xs">{o.label}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <hr className="border-border" />

        {/* Step 2: TMB */}
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-base">Passo 2 — TMB de referência</h2>
          {isLocked ? (
            <>
              <div className={readOnlyClass}>
                {profile.tmb_metodo === 'katch' ? 'Katch-McArdle' : 'Mifflin-St Jeor'} — {profile.tmb_metodo === 'katch' && meta.tmb_katch ? meta.tmb_katch : meta.tmb_mifflin} kcal
              </div>
              <div className={readOnlyClass}>
                Nível de atividade: ×{profile.nivel_atividade} — {NIVEL_ATIVIDADE_OPTIONS.find(o => o.value === profile.nivel_atividade)?.label || ''}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <button
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    profile.tmb_metodo === 'mifflin' ? 'border-primary bg-primary/5' : 'border-input hover:bg-secondary'
                  }`}
                  onClick={() => setProfile({ tmb_metodo: 'mifflin' })}
                >
                  <p className="text-sm font-body font-medium">Mifflin-St Jeor</p>
                  <p className="text-lg font-heading font-bold">{meta.tmb_mifflin} kcal</p>
                </button>
                <button
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    profile.tmb_metodo === 'katch' ? 'border-primary bg-primary/5' : 'border-input hover:bg-secondary'
                  } ${!meta.tmb_katch ? 'opacity-50' : ''}`}
                  onClick={() => meta.tmb_katch && setProfile({ tmb_metodo: 'katch' })}
                  disabled={!meta.tmb_katch}
                >
                  <p className="text-sm font-body font-medium">Katch-McArdle</p>
                  <p className="text-lg font-heading font-bold">{meta.tmb_katch ? `${meta.tmb_katch} kcal` : 'Calcule as dobras cutâneas primeiro'}</p>
                </button>
              </div>

              <div>
                <label className={labelClass}>Nível de atividade</label>
                <select
                  value={profile.nivel_atividade}
                  onChange={e => setProfile({ nivel_atividade: Number(e.target.value) })}
                  className={inputClass}
                >
                  {NIVEL_ATIVIDADE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label} (×{o.value}) — {o.desc}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Meta base</p>
            <p className="font-heading text-xl font-bold">{meta.metaBase} kcal/dia</p>
          </div>
        </section>

        <hr className="border-border" />

        {/* Step 3: Manual adjustment - ALWAYS editable */}
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-base">Passo 3 — Ajuste manual</h2>

          {/* Direction toggle */}
          <div className="flex gap-2">
            <button
              className={`flex-1 rounded-lg border py-2.5 text-sm font-body transition-colors ${
                profile.ajuste_calorico <= 0 ? 'border-destructive bg-destructive/10 font-medium text-destructive' : 'border-input hover:bg-secondary'
              }`}
              onClick={() => setProfile({ ajuste_calorico: -Math.abs(profile.ajuste_calorico || 0) })}
            >
              − Déficit
            </button>
            <button
              className={`flex-1 rounded-lg border py-2.5 text-sm font-body transition-colors ${
                profile.ajuste_calorico > 0 ? 'border-success bg-success/10 font-medium text-success' : 'border-input hover:bg-secondary'
              }`}
              onClick={() => setProfile({ ajuste_calorico: Math.abs(profile.ajuste_calorico || 0) })}
            >
              + Superávit
            </button>
          </div>

          {/* Value with +/- buttons */}
          <div className="flex items-center gap-3">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-background text-lg font-bold hover:bg-secondary transition-colors"
              onClick={() => {
                const abs = Math.max(0, Math.abs(profile.ajuste_calorico) - 50);
                const sign = profile.ajuste_calorico <= 0 ? -1 : 1;
                setProfile({ ajuste_calorico: abs * sign });
              }}
            >
              −
            </button>
            <div className="flex-1 relative">
              <input
                type="number"
                inputMode="numeric"
                value={Math.abs(profile.ajuste_calorico)}
                onChange={e => {
                  const abs = Math.max(0, Number(e.target.value) || 0);
                  const sign = profile.ajuste_calorico <= 0 ? -1 : 1;
                  setProfile({ ajuste_calorico: abs === 0 ? 0 : abs * sign });
                }}
                className={inputClass + ' text-center'}
                min="0"
                step="50"
              />
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-background text-lg font-bold hover:bg-secondary transition-colors"
              onClick={() => {
                const abs = Math.abs(profile.ajuste_calorico) + 50;
                const sign = profile.ajuste_calorico <= 0 ? -1 : 1;
                setProfile({ ajuste_calorico: abs * sign });
              }}
            >
              +
            </button>
            <span className="text-xs text-muted-foreground w-8">kcal</span>
          </div>

          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-sm text-muted-foreground font-body">
              {meta.metaBase} (base) {profile.ajuste_calorico >= 0 ? '+' : '−'} {Math.abs(profile.ajuste_calorico)} ({profile.ajuste_calorico <= 0 ? 'déficit' : 'superávit'}) =
            </p>
            <p className="font-heading text-2xl font-bold text-primary">{meta.metaFinal} kcal/dia</p>
          </div>
          {warning && (
            <div className="rounded-lg bg-caution/10 px-3 py-2.5 text-sm font-body text-foreground">
              {warning}
            </div>
          )}
        </section>

        <hr className="border-border" />

        {/* Step 4: Macro distribution */}
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-base">Passo 4 — Distribuição de Macros</h2>

          {isLocked ? (
            <div className="space-y-2">
              <div className={readOnlyClass}>Proteína: {profile.macro_proteina_multiplicador}g × peso ({profile.peso || 70}kg) = {macros.proteina.g}g</div>
              <div className={readOnlyClass}>Gordura: {profile.macro_gordura_percentual}% das calorias = {macros.gordura.g}g</div>
            </div>
          ) : (
            <>
              <div>
                <label className={labelClass}>Proteína: {profile.macro_proteina_multiplicador}g × peso ({profile.peso || 70}kg) = {macros.proteina.g}g</label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8">×</span>
                  <input
                    type="number"
                    value={profile.macro_proteina_multiplicador}
                    onChange={e => setProfile({ macro_proteina_multiplicador: Number(e.target.value) || 2.2 })}
                    className={inputClass}
                    step="0.1"
                    min="0.5"
                    max="4"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Gordura: {profile.macro_gordura_percentual}% das calorias = {macros.gordura.g}g</label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8">%</span>
                  <input
                    type="number"
                    value={profile.macro_gordura_percentual}
                    onChange={e => setProfile({ macro_gordura_percentual: Number(e.target.value) || 15 })}
                    className={inputClass}
                    step="1"
                    min="5"
                    max="50"
                  />
                </div>
              </div>
            </>
          )}

          {/* Summary */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-4 text-center text-xs text-muted-foreground border-b border-border">
              <div className="p-2">Macro</div>
              <div className="p-2">Gramas</div>
              <div className="p-2">Kcal</div>
              <div className="p-2">%</div>
            </div>
            {([
              { label: 'Proteína', ...macros.proteina },
              { label: 'Gordura', ...macros.gordura },
              { label: 'Carboidrato', ...macros.carbo },
            ]).map(m => (
              <div key={m.label} className="grid grid-cols-4 text-center text-sm border-b border-border last:border-0">
                <div className="p-2 font-body font-medium text-left pl-3">{m.label}</div>
                <div className="p-2 font-heading font-bold">{m.g}g</div>
                <div className="p-2">{m.kcal}</div>
                <div className="p-2">{m.pct}%</div>
              </div>
            ))}
            <div className="grid grid-cols-4 text-center text-sm bg-secondary/50 font-medium">
              <div className="p-2 text-left pl-3">Total</div>
              <div className="p-2">—</div>
              <div className="p-2 font-heading font-bold">{macros.totalKcal}</div>
              <div className="p-2">100%</div>
            </div>
          </div>

          {Math.abs(macros.totalKcal - meta.metaFinal) > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              Diferença de {Math.abs(macros.totalKcal - meta.metaFinal)} kcal entre macros e meta (por arredondamento)
            </p>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
