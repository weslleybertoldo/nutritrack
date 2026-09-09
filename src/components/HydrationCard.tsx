import React, { useState, useEffect, useCallback } from 'react';
import { Droplets, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Spinner } from '@/components/ui/spinner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface WaterRecord {
  id: string;
  quantidade_ml: number;
  registrado_em: string;
}

interface HydrationCardProps {
  selectedDate: string;
  pesoKg?: number;
}

function formatHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatMl(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1).replace('.', ',')}L`;
  return `${ml}ml`;
}

const isTemp = (id: string) => id.startsWith('temp-');

export default function HydrationCard({ selectedDate, pesoKg }: HydrationCardProps) {
  const { user } = useAuth();
  const [records, setRecords] = useState<WaterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [quantidade, setQuantidade] = useState('');
  const [saving, setSaving] = useState(false);

  const metaMl = pesoKg && pesoKg > 0
    ? Math.max(1500, Math.round(pesoKg * 35))
    : 2000;

  const totalMl = records.reduce((acc, r) => acc + r.quantidade_ml, 0);
  const progress = Math.min((totalMl / metaMl) * 100, 100);

  const loadRecords = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('water_intake')
        .select('id, quantidade_ml, registrado_em')
        .eq('user_id', user.id)
        .eq('data', selectedDate)
        .order('registrado_em', { ascending: false });
      if (error) throw error;
      // Preserva registros otimistas ainda em voo (id temporário).
      setRecords(prev => [...prev.filter(r => isTemp(r.id)), ...((data as WaterRecord[]) || [])]);
    } catch (err: any) {
      console.error('Erro ao carregar água:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Registrar é OTIMISTA: o total e a lista atualizam no toque; a rede confirma
  // depois (e reverte com aviso se falhar). Antes: insert + reload em série.
  const handleRegistrar = async () => {
    if (!user) return;
    const ml = parseInt(quantidade, 10);
    if (!ml || ml <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }
    const tempId = `temp-${Date.now()}`;
    const optimistic: WaterRecord = { id: tempId, quantidade_ml: ml, registrado_em: new Date().toISOString() };
    setRecords(prev => [optimistic, ...prev]);
    setQuantidade('');
    setSaving(true);
    try {
      const { data, error } = await (supabase as any)
        .from('water_intake')
        .insert({ user_id: user.id, data: selectedDate, quantidade_ml: ml })
        .select('id, quantidade_ml, registrado_em')
        .single();
      if (error) throw error;
      setRecords(prev => prev.map(r => (r.id === tempId ? (data as WaterRecord) : r)));
      toast.success(`${formatMl(ml)} registrado! 💧`);
    } catch (err: any) {
      console.error('[HydrationCard] Erro ao registrar:', err?.message);
      setRecords(prev => prev.filter(r => r.id !== tempId));
      setQuantidade(String(ml));
      toast.error('Erro ao registrar água');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || isTemp(id)) return;
    const removido = records.find(r => r.id === id);
    // Otimista: some da lista na hora.
    setRecords(prev => prev.filter(r => r.id !== id));
    try {
      const { error } = await (supabase as any)
        .from('water_intake')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    } catch (e) {
      console.error('[HydrationCard] Erro ao remover:', e);
      if (removido) setRecords(prev => [...prev, removido].sort((a, b) => b.registrado_em.localeCompare(a.registrado_em)));
      toast.error('Erro ao remover registro');
    }
  };

  const progressColor =
    progress >= 100
      ? '[&>div]:bg-classify-blue'
      : progress >= 60
      ? '[&>div]:bg-classify-blue/80'
      : '[&>div]:bg-classify-blue/60';

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="rounded-lg border border-border bg-card overflow-hidden mb-3"
    >
      <button
        type="button"
        className="pressable-row flex w-full items-center justify-between p-4 text-left"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <Droplets className="h-5 w-5 text-classify-blue shrink-0" />
          <div className="flex-1">
            <p className="font-heading font-semibold text-sm">Hidratação diária</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              {loading && records.length === 0 ? (
                <><Spinner size={11} /> Carregando...</>
              ) : (
                `${formatMl(totalMl)} de ${formatMl(metaMl)}`
              )}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ease-out ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className="px-4 pb-3">
        <Progress value={progress} className={`h-2 ${progressColor}`} />
        {progress >= 100 && (
          <p className="text-xs text-classify-blue mt-1 font-body fade-enter">💧 Meta de hidratação atingida!</p>
        )}
      </div>

      <div className="px-4 pb-4 flex gap-2 items-center">
        <input
          type="number"
          placeholder="ml (ex: 300)"
          value={quantidade}
          onChange={e => setQuantidade(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRegistrar()}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
          min="1"
          max="5000"
          aria-label="Quantidade em ml"
        />
        <Button
          size="sm"
          onClick={handleRegistrar}
          disabled={saving || !quantidade}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {saving ? <Spinner size={16} className="mr-1 text-primary-foreground" /> : <Plus className="h-4 w-4 mr-1" />}
          Registrar
        </Button>
      </div>

      <CollapsibleContent>
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs font-heading uppercase tracking-wider text-muted-foreground mb-2">
            Registros de hoje
          </p>
          {records.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhum registro ainda.</p>
          ) : (
            <div className="space-y-1">
              {records.map(r => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between py-1.5 border-b border-border last:border-0 fade-enter ${isTemp(r.id) ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <Droplets className="h-3.5 w-3.5 text-classify-blue" />
                    <span className="text-sm font-body font-medium">{formatMl(r.quantidade_ml)}</span>
                    <span className="text-xs text-muted-foreground">{formatHora(r.registrado_em)}</span>
                    {isTemp(r.id) && <Spinner size={11} />}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    disabled={isTemp(r.id)}
                    aria-label="Remover registro"
                    className="pressable-sm text-xs text-muted-foreground hover:text-destructive px-1 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
