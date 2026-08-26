import React from 'react';
import AppLayout from '@/components/AppLayout';
import { useApp } from '@/context/AppContext';
import { NIVEL_ATIVIDADE_OPTIONS, Objetivo } from '@/types';
import { calcularMetaCalorica, calcularMacros } from '@/lib/calculations';
import { Lock, Minus, Plus } from 'lucide-react';

export default function GoalsPage() {
  const { profile, setProfile } = useApp();
  const isLocked = profile.admin_locked === true;
  const meta = calcularMetaCalorica(profile);
  const macros = calcularMacros(profile, meta.metaFinal);

  const inputClass = "input-underline-sm";
  const readOnlyClass = "w-full border-b border-muted-foreground/30 py-2.5 text-sm font-body text-muted-foreground";
  const labelClass = "label-caps mb-1 block";
  const toggleClass = (active: boolean) =>
    `flex-1 py-3 px-2 font-heading text-xs uppercase tracking-widest transition-colors duration-200 ${active ? 'toggle-active' : 'toggle-inactive'}`;

  // Warnings
  const getAjusteWarning = () => {
    const aj = profile.ajuste_calorico;
    if (profile.objetivo === 'manter' && aj > 0) return `Você está consumindo ${aj} kcal acima da sua meta de manutenção. Com isso, tende a ganhar peso.`;
    if (profile.objetivo === 'manter' && aj < 0) return `Você está consumindo ${Math.abs(aj)} kcal abaixo da sua meta de manutenção. Com isso, tende a perder peso.`;
    if (profile.objetivo === 'perder' && aj > 0) return 'Atenção: o ajuste positivo pode comprometer seu déficit calórico.';
    if (profile.objetivo === 'ganhar' && aj < 0) return 'O ajuste negativo pode reduzir seu superávit calórico.';
    return null;
  };

  const warning = getAjusteWarning();
  const objetivoLabel = profile.objetivo === 'perder' ? 'Perder peso' : profile.objetivo === 'ganhar' ? 'Ganhar peso' : 'Manter';

  return (
    <AppLayout title="Minha Meta">
      <div className="space-y-8 pb-8">
        {isLocked && (
          <div className="flex items-start gap-2 border-l-2 border-primary bg-primary/10 px-3 py-2.5 text-xs text-primary font-body">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Metas bloqueadas pelo administrador. Apenas o ajuste manual (Passo 3) está disponível.</span>
          </div>
        )}

        {/* Step 1: Objective */}
        <section className="space-y-3">
          <h2 className="text-base">Passo 1 — Objetivo</h2>
          {isLocked ? (
            <div className={readOnlyClass}>{objetivoLabel}</div>
          ) : (
            <div className="flex gap-0">
              {([
                { value: 'perder' as Objetivo, label: 'Perder peso' },
                { value: 'manter' as Objetivo, label: 'Manter' },
                { value: 'ganhar' as Objetivo, label: 'Ganhar peso' },
              ]).map(o => (
                <button
                  key={o.value}
                  type="button"
                  className={toggleClass(profile.objetivo === o.value)}
                  onClick={() => setProfile({ objetivo: o.value })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <hr className="section-divider" />

        {/* Step 2: TMB */}
        <section className="space-y-3">
          <h2 className="text-base">Passo 2 — TMB de referência</h2>
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
                  type="button"
                  className={`w-full border p-4 text-left transition-colors ${
                    profile.tmb_metodo === 'mifflin' ? 'border-primary bg-primary/10' : 'border-muted-foreground/30 hover:bg-secondary'
                  }`}
                  onClick={() => setProfile({ tmb_metodo: 'mifflin' })}
                >
                  <p className="label-caps">Mifflin-St Jeor</p>
                  <p className="text-xl font-heading text-foreground">{meta.tmb_mifflin} <span className="text-sm text-muted-foreground">kcal</span></p>
                </button>
                <button
                  type="button"
                  className={`w-full border p-4 text-left transition-colors ${
                    profile.tmb_metodo === 'katch' ? 'border-primary bg-primary/10' : 'border-muted-foreground/30 hover:bg-secondary'
                  } ${!meta.tmb_katch ? 'opacity-50' : ''}`}
                  onClick={() => meta.tmb_katch && setProfile({ tmb_metodo: 'katch' })}
                  disabled={!meta.tmb_katch}
                >
                  <p className="label-caps">Katch-McArdle</p>
                  <p className="text-xl font-heading text-foreground">
                    {meta.tmb_katch ? <>{meta.tmb_katch} <span className="text-sm text-muted-foreground">kcal</span></> : <span className="text-sm text-muted-foreground font-body normal-case">Calcule as dobras cutâneas primeiro</span>}
                  </p>
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

          <div className="result-card border-muted-foreground/30 p-4 text-center">
            <p className="label-caps">Meta base</p>
            <p className="font-heading text-2xl text-foreground">{meta.metaBase} <span className="text-sm text-muted-foreground">kcal/dia</span></p>
          </div>
        </section>

        <hr className="section-divider" />

        {/* Step 3: Manual adjustment - ALWAYS editable */}
        <section className="space-y-3">
          <h2 className="text-base">Passo 3 — Ajuste manual</h2>

          {/* Direction toggle */}
          <div className="flex gap-0">
            <button
              type="button"
              className={toggleClass(profile.ajuste_calorico <= 0)}
              onClick={() => setProfile({ ajuste_calorico: -Math.abs(profile.ajuste_calorico || 0) })}
            >
              − Déficit
            </button>
            <button
              type="button"
              className={toggleClass(profile.ajuste_calorico > 0)}
              onClick={() => setProfile({ ajuste_calorico: Math.abs(profile.ajuste_calorico || 0) })}
            >
              + Superávit
            </button>
          </div>

          {/* Value with +/- buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Diminuir 50 kcal"
              className="flex h-11 w-11 shrink-0 items-center justify-center border border-muted-foreground/40 text-foreground hover:bg-secondary transition-colors"
              onClick={() => {
                const abs = Math.max(0, Math.abs(profile.ajuste_calorico) - 50);
                const sign = profile.ajuste_calorico <= 0 ? -1 : 1;
                setProfile({ ajuste_calorico: abs * sign });
              }}
            >
              <Minus size={16} />
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
                className="h-11 w-full bg-transparent border-b border-t border-muted-foreground text-center text-foreground font-heading text-lg outline-none focus:border-primary transition-colors"
                min="0"
                step="50"
              />
            </div>
            <button
              type="button"
              aria-label="Aumentar 50 kcal"
              className="flex h-11 w-11 shrink-0 items-center justify-center border border-muted-foreground/40 text-foreground hover:bg-secondary transition-colors"
              onClick={() => {
                const abs = Math.abs(profile.ajuste_calorico) + 50;
                const sign = profile.ajuste_calorico <= 0 ? -1 : 1;
                setProfile({ ajuste_calorico: abs * sign });
              }}
            >
              <Plus size={16} />
            </button>
            <span className="label-caps w-8">kcal</span>
          </div>

          <div className="result-card border-primary/50 p-4 text-center">
            <p className="text-sm text-muted-foreground font-body">
              {meta.metaBase} (base) {profile.ajuste_calorico >= 0 ? '+' : '−'} {Math.abs(profile.ajuste_calorico)} ({profile.ajuste_calorico <= 0 ? 'déficit' : 'superávit'}) =
            </p>
            <p className="font-heading text-3xl text-primary">{meta.metaFinal} <span className="text-sm text-muted-foreground">kcal/dia</span></p>
          </div>
          {warning && (
            <div className="border-l-2 border-caution bg-caution/10 px-3 py-2.5 text-sm font-body text-foreground">
              {warning}
            </div>
          )}
        </section>

        <hr className="section-divider" />

        {/* Step 4: Macro distribution */}
        <section className="space-y-3">
          <h2 className="text-base">Passo 4 — Distribuição de Macros</h2>

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
                  <span className="label-caps w-8">×</span>
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
                  <span className="label-caps w-8">%</span>
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
          <div className="border border-muted-foreground/30 overflow-hidden">
            <div className="grid grid-cols-4 text-center label-caps border-b border-muted-foreground/30">
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
              <div key={m.label} className="grid grid-cols-4 text-center text-sm border-b border-muted-foreground/30 last:border-0">
                <div className="p-2 font-body text-left pl-3">{m.label}</div>
                <div className="p-2 font-heading text-primary">{m.g}g</div>
                <div className="p-2">{m.kcal}</div>
                <div className="p-2">{m.pct}%</div>
              </div>
            ))}
            <div className="grid grid-cols-4 text-center text-sm bg-secondary font-medium">
              <div className="p-2 text-left pl-3">Total</div>
              <div className="p-2">—</div>
              <div className="p-2 font-heading">{macros.totalKcal}</div>
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
