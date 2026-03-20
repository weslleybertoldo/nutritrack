import React from 'react';
import AppLayout from '@/components/AppLayout';
import { useApp } from '@/context/AppContext';
import { calcularIdade, calcularPercentualGordura3Dobras, calcularComposicaoCorporal } from '@/lib/calculations';
import { Sexo } from '@/types';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
  const { profile, setProfile } = useApp();
  const isLocked = profile.admin_locked === true;

  const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring";
  const readOnlyClass = "w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm font-body text-muted-foreground";
  const labelClass = "text-xs text-muted-foreground mb-1 block font-body";

  const idade = profile.data_nascimento ? calcularIdade(profile.data_nascimento) : null;

  const handleCalculateBF = () => {
    if (!profile.sexo || !profile.data_nascimento || !profile.peso) return;
    const idadeAtual = calcularIdade(profile.data_nascimento);

    let d1: number, d2: number, d3: number;
    if (profile.sexo === 'masculino') {
      d1 = profile.dc_peitoral || 0;
      d2 = profile.dc_abdominal || 0;
      d3 = profile.dc_coxa || 0;
    } else {
      d1 = profile.dc_tricipital || 0;
      d2 = profile.dc_suprailiaca || 0;
      d3 = profile.dc_coxa || 0;
    }

    if (d1 === 0 || d2 === 0 || d3 === 0) return;

    const pct = calcularPercentualGordura3Dobras(profile.sexo, idadeAtual, { d1, d2, d3 });
    const { massaGorda, massaMagra } = calcularComposicaoCorporal(profile.peso, pct);
    setProfile({
      percentual_gordura: Math.round(pct * 10) / 10,
      massa_gorda: massaGorda,
      massa_magra: massaMagra,
    });
  };

  // 3-fold fields based on sex
  const dobrasFields = profile.sexo === 'feminino'
    ? [
        ['dc_tricipital', 'Tríceps'] as const,
        ['dc_suprailiaca', 'Supra-ilíaca'] as const,
        ['dc_coxa', 'Coxa'] as const,
      ]
    : [
        ['dc_peitoral', 'Peitoral'] as const,
        ['dc_abdominal', 'Abdominal'] as const,
        ['dc_coxa', 'Coxa'] as const,
      ];

  const renderField = (
    type: string,
    value: any,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    props?: Record<string, any>
  ) => {
    if (isLocked) {
      return <div className={readOnlyClass}>{value || '—'}</div>;
    }
    return <input type={type} value={value} onChange={onChange} className={inputClass} {...props} />;
  };

  return (
    <AppLayout title="Perfil">
      <div className="space-y-6 pb-8">
        {isLocked && (
          <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground font-body">
            🔒 Edição bloqueada pelo administrador. Entre em contato para alterações.
          </div>
        )}

        {/* Basic info */}
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-base">Dados Pessoais</h2>
          <div>
            <label className={labelClass}>Nome completo</label>
            {renderField('text', profile.nome, e => setProfile({ nome: e.target.value }), { placeholder: 'Seu nome' })}
          </div>
          <div>
            <label className={labelClass}>Email</label>
            {renderField('email', profile.email, e => setProfile({ email: e.target.value }), { placeholder: 'email@exemplo.com' })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Data de nascimento</label>
              {isLocked ? (
                <div className={readOnlyClass}>{profile.data_nascimento || '—'}</div>
              ) : (
                <input type="date" value={profile.data_nascimento || ''} onChange={e => setProfile({ data_nascimento: e.target.value })} className={inputClass} />
              )}
            </div>
            <div>
              <label className={labelClass}>Idade</label>
              <div className="rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm font-body">
                {idade !== null ? `${idade} anos` : '—'}
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Sexo</label>
            {isLocked ? (
              <div className={readOnlyClass}>{profile.sexo === 'masculino' ? 'Masculino' : profile.sexo === 'feminino' ? 'Feminino' : '—'}</div>
            ) : (
              <div className="flex gap-2">
                {(['masculino', 'feminino'] as Sexo[]).map(s => (
                  <button
                    key={s}
                    className={`flex-1 rounded-lg border py-2.5 text-sm font-body transition-colors ${
                      profile.sexo === s ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-input hover:bg-secondary'
                    }`}
                    onClick={() => setProfile({ sexo: s })}
                  >
                    {s === 'masculino' ? 'Masculino' : 'Feminino'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Peso (kg)</label>
              {renderField('number', profile.peso || '', e => setProfile({ peso: Number(e.target.value) || undefined }), { step: '0.1', placeholder: '70' })}
            </div>
            <div>
              <label className={labelClass}>Altura (cm)</label>
              {renderField('number', profile.altura || '', e => setProfile({ altura: Number(e.target.value) || undefined }), { placeholder: '170' })}
            </div>
          </div>
        </section>

        <hr className="border-border" />

        {/* Dobras cutâneas - 3 dobras */}
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-base">Dobras Cutâneas <span className="text-xs text-muted-foreground font-body font-normal">(opcional)</span></h2>
          <p className="text-xs text-muted-foreground">
            Protocolo Jackson & Pollock — 3 dobras (mm)
            {profile.sexo === 'feminino' ? ' · Tríceps, Supra-ilíaca, Coxa' : ' · Peitoral, Abdominal, Coxa'}
          </p>
          {!profile.sexo && (
            <p className="text-xs text-warning-foreground bg-warning/10 rounded-lg px-3 py-2">
              Selecione o sexo acima para ver os campos corretos.
            </p>
          )}
          {profile.sexo && (
            <div className="grid grid-cols-3 gap-3">
              {dobrasFields.map(([key, label]) => (
                <div key={key}>
                  <label className={labelClass}>{label}</label>
                  {isLocked ? (
                    <div className={readOnlyClass}>{profile[key] || '—'}</div>
                  ) : (
                    <input
                      type="number"
                      value={profile[key] || ''}
                      onChange={e => setProfile({ [key]: Number(e.target.value) || undefined } as any)}
                      className={inputClass}
                      step="0.1"
                      placeholder="mm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {!isLocked && (
            <Button variant="outline" className="w-full" onClick={handleCalculateBF} disabled={!profile.sexo}>
              Calcular composição corporal
            </Button>
          )}
          {profile.percentual_gordura != null && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">% Gordura</p>
                <p className="font-heading font-bold">{profile.percentual_gordura}%</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Massa Gorda</p>
                <p className="font-heading font-bold">{profile.massa_gorda} kg</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Massa Magra</p>
                <p className="font-heading font-bold">{profile.massa_magra} kg</p>
              </div>
            </div>
          )}
        </section>

        <hr className="border-border" />

        {/* Metas de Micronutrientes */}
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-base">Metas de Micronutrientes</h2>
          <p className="text-xs text-muted-foreground">Meta diária para cada micronutriente</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['meta_fibras', 'Fibras (g)', 'g'] as const,
              ['meta_sodio', 'Sódio (mg)', 'mg'] as const,
              ['meta_acucares', 'Açúcares (g)', 'g'] as const,
              ['meta_gordura_saturada', 'Gord. Saturada (g)', 'g'] as const,
              ['meta_colesterol', 'Colesterol (mg)', 'mg'] as const,
              ['meta_potassio', 'Potássio (mg)', 'mg'] as const,
            ]).map(([key, label]) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                {isLocked ? (
                  <div className={readOnlyClass}>{profile[key] || '—'}</div>
                ) : (
                  <input
                    type="number"
                    value={profile[key] || ''}
                    onChange={e => setProfile({ [key]: Number(e.target.value) || 0 } as any)}
                    className={inputClass}
                    step="1"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
