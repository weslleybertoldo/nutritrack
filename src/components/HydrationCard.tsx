import React, { useState, useEffect, useCallback } from 'react';
import { Droplets, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
      setRecords((data as WaterRecord[]) || []);
    } catch (err: any) {
      console.error('Erro ao carregar água:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleRegistrar = async () => {
    if (!user) return;
    const ml = parseInt(quantidade, 10);
    if (!ml || ml <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('water_intake').insert({
        user_id: user.id,
        data: selectedDate,
        quantidade_ml: ml,
      });
      if (error) throw error;
      setQuantidade('');
      await loadRecords();
      toast.success(`${formatMl(ml)} registrado! 💧`);
    } catch (err: any) {
      toast.error('Erro ao registrar água');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await (supabase as any)
        .from('water_intake')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      await loadRecords();
    } catch (e) {
      console.error('[HydrationCard] Erro ao remover:', e);
      toast.error('Erro ao remover registro');
    }
  };

  const progressColor =
    progress >= 100
      ? '[&>div]:bg-blue-500'
      : progress >= 60
      ? '[&>div]:bg-blue-400'
      : '[&>div]:bg-blue-300';

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden mb-3">
      <button
        className="flex w-full items-center justify-between p-4"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <Droplets className="h-5 w-5 text-blue-400 shrink-0" />
          <div className="flex-1">
            <p className="font-heading font-semibold text-sm">Hidratação diária</p>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Carregando...' : `${formatMl(totalMl)} de ${formatMl(metaMl)}`}
            </p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      <div className="px-4 pb-3">
        <Progress value={progress} className={`h-2 ${progressColor}`} />
        {progress >= 100 && (
          <p className="text-xs text-blue-400 mt-1 font-body">💧 Meta de hidratação atingida!</p>
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
        />
        <Button
          size="sm"
          onClick={handleRegistrar}
          disabled={saving || !quantidade}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Registrar
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 animate-fade-in">
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
                  className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Droplets className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-sm font-body font-medium">{formatMl(r.quantidade_ml)}</span>
                    <span className="text-xs text-muted-foreground">{formatHora(r.registrado_em)}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
