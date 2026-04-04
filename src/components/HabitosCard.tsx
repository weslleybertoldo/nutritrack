import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, Pencil, Trash2, X, Bell, BellOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  getReminder,
  setReminder,
  removeReminder,
  scheduleHabitNotification,
  cancelHabitNotification,
  onHabitCompleted,
  createHabitReminderChannel,
} from '@/lib/habitReminders';

interface Habito {
  id: string;
  nome: string;
  ordem: number;
}

interface HabitosCardProps {
  selectedDate: string; // "YYYY-MM-DD"
}

export default function HabitosCard({ selectedDate }: HabitosCardProps) {
  const { user } = useAuth();
  const [habitos, setHabitos] = useState<Habito[]>([]);
  const [concluidos, setConcluidos] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [adicionando, setAdicionando] = useState(false);

  // Estado do lembrete sendo configurado
  const [configurandoLembreteId, setConfigurandoLembreteId] = useState<string | null>(null);
  const [lembreteHora, setLembreteHora] = useState('20:00');

  // Cria canal de notificação na montagem
  useEffect(() => { createHabitReminderChannel(); }, []);

  const loadHabitos = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('habitos')
      .select('id, nome, ordem')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .order('ordem');
    if (error) { console.warn('Erro ao carregar hábitos:', error.message); toast.error('Erro ao carregar hábitos'); setLoading(false); return; }
    if (data) setHabitos(data as Habito[]);
    setLoading(false);
  }, [user]);

  const loadConcluidos = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('habitos_registro')
      .select('habito_id')
      .eq('user_id', user.id)
      .eq('data', selectedDate);
    if (error) { console.warn('Erro ao carregar concluídos:', error.message); return; }
    if (data) setConcluidos(new Set(data.map(r => r.habito_id)));
  }, [user, selectedDate]);

  useEffect(() => { loadHabitos(); }, [loadHabitos]);
  useEffect(() => { loadConcluidos(); }, [loadConcluidos]);

  // Inicializa com creatina se não tiver nenhum
  useEffect(() => {
    if (!loading && habitos.length === 0 && user) {
      supabase.from('habitos')
        .insert({ user_id: user.id, nome: 'Creatina', ordem: 0, ativo: true })
        .select('id, nome, ordem')
        .single()
        .then(({ data, error }) => {
          if (error) { console.warn('Erro ao criar hábito padrão:', error.message); return; }
          if (data) setHabitos([data as Habito]);
        });
    }
  }, [loading, habitos.length, user]);

  const handleToggle = async (habitoId: string) => {
    if (!user) return;
    const habito = habitos.find(h => h.id === habitoId);
    const jaConcluido = concluidos.has(habitoId);
    if (jaConcluido) {
      const { error } = await supabase.from('habitos_registro')
        .delete()
        .eq('user_id', user.id)
        .eq('habito_id', habitoId)
        .eq('data', selectedDate);
      if (error) { console.warn('Erro ao desmarcar hábito:', error.message); toast.error('Erro ao desmarcar hábito'); return; }
      setConcluidos(prev => { const s = new Set(prev); s.delete(habitoId); return s; });
    } else {
      const { error } = await supabase.from('habitos_registro')
        .insert({ user_id: user.id, habito_id: habitoId, data: selectedDate });
      if (error) { console.warn('Erro ao marcar hábito:', error.message); toast.error('Erro ao marcar hábito'); return; }
      setConcluidos(prev => new Set([...prev, habitoId]));

      // Hábito concluído → cancela notificação de hoje e reagenda para amanhã
      if (habito) {
        onHabitCompleted(habitoId, habito.nome);
      }
    }
  };

  const handleAddHabito = async () => {
    if (!novoNome.trim() || !user) return;
    const maxOrdem = habitos.length > 0 ? Math.max(...habitos.map(h => h.ordem)) + 1 : 0;
    const { data, error } = await supabase.from('habitos')
      .insert({ user_id: user.id, nome: novoNome.trim(), ordem: maxOrdem, ativo: true })
      .select('id, nome, ordem').single();
    if (error) { console.warn('Erro ao adicionar hábito:', error.message); toast.error('Erro ao adicionar hábito'); return; }
    if (data) {
      setHabitos(prev => [...prev, data as Habito]);
      setNovoNome('');
      toast.success(`"${(data as Habito).nome}" adicionado!`);
    }
  };

  const handleRenomear = async (id: string) => {
    if (!editandoNome.trim()) return;
    const { error } = await supabase.from('habitos').update({ nome: editandoNome.trim() }).eq('id', id);
    if (error) { console.warn('Erro ao renomear hábito:', error.message); toast.error('Erro ao renomear hábito'); return; }
    setHabitos(prev => prev.map(h => h.id === id ? { ...h, nome: editandoNome.trim() } : h));
    setEditandoId(null);

    // Se tem lembrete ativo, reagenda com novo nome
    const reminder = getReminder(id);
    if (reminder.ativo) {
      scheduleHabitNotification(id, editandoNome.trim(), reminder.hora, reminder.minuto);
    }
  };

  const handleExcluir = async (id: string) => {
    const { error } = await supabase.from('habitos').update({ ativo: false }).eq('id', id);
    if (error) { console.warn('Erro ao excluir hábito:', error.message); toast.error('Erro ao excluir hábito'); return; }
    setHabitos(prev => prev.filter(h => h.id !== id));
    setConcluidos(prev => { const s = new Set(prev); s.delete(id); return s; });

    // Remove lembrete e cancela notificação
    removeReminder(id);
    cancelHabitNotification(id);
  };

  // ── Lembrete ──

  const handleAbrirLembrete = (habitoId: string) => {
    const reminder = getReminder(habitoId);
    setLembreteHora(`${String(reminder.hora).padStart(2, '0')}:${String(reminder.minuto).padStart(2, '0')}`);
    setConfigurandoLembreteId(habitoId);
  };

  const handleSalvarLembrete = async (habitoId: string) => {
    const [h, m] = lembreteHora.split(':').map(Number);
    const habito = habitos.find(hab => hab.id === habitoId);
    if (!habito) return;

    setReminder(habitoId, h, m, true);
    await scheduleHabitNotification(habitoId, habito.nome, h, m);
    setConfigurandoLembreteId(null);
    toast.success(`Lembrete de "${habito.nome}" configurado para ${lembreteHora}`);
  };

  const handleDesativarLembrete = async (habitoId: string) => {
    const habito = habitos.find(hab => hab.id === habitoId);
    setReminder(habitoId, 0, 0, false);
    await cancelHabitNotification(habitoId);
    setConfigurandoLembreteId(null);
    toast.success(`Lembrete de "${habito?.nome}" desativado`);
  };

  if (loading) return null;

  return (
    <div className="rounded-lg border border-border bg-card mb-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-heading font-semibold text-sm">Hábitos diários</span>
        <button
          onClick={() => setEditando(e => !e)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors font-heading"
        >
          {editando ? 'Fechar' : 'Editar'}
        </button>
      </div>

      {/* Botões de hábitos */}
      <div className="px-4 pb-3 flex flex-wrap gap-2">
        {habitos.map(h => {
          const feito = concluidos.has(h.id);
          const reminder = getReminder(h.id);
          return (
            <div key={h.id} className="flex items-center gap-1">
              {editando && editandoId === h.id ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editandoNome}
                    onChange={e => setEditandoNome(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenomear(h.id); if (e.key === 'Escape') setEditandoId(null); }}
                    className="w-24 bg-transparent border-b border-primary text-sm font-body outline-none py-0.5"
                  />
                  <button onClick={() => handleRenomear(h.id)} className="text-primary"><Check size={12} /></button>
                  <button onClick={() => setEditandoId(null)} className="text-muted-foreground"><X size={12} /></button>
                </div>
              ) : (
                <button
                  onClick={() => !editando && handleToggle(h.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-heading transition-all ${
                    feito
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-foreground hover:border-primary hover:text-primary'
                  }`}
                >
                  {feito && <Check size={11} />}
                  {h.nome}
                  {reminder.ativo && !editando && (
                    <Bell size={9} className="opacity-50" />
                  )}
                </button>
              )}
              {editando && editandoId !== h.id && (
                <div className="flex gap-0.5">
                  <button
                    onClick={() => handleAbrirLembrete(h.id)}
                    className={`p-1 transition-colors ${
                      reminder.ativo
                        ? 'text-primary hover:text-primary/80'
                        : 'text-muted-foreground hover:text-primary'
                    }`}
                    title={reminder.ativo ? `Lembrete: ${String(reminder.hora).padStart(2, '0')}:${String(reminder.minuto).padStart(2, '0')}` : 'Configurar lembrete'}
                  >
                    {reminder.ativo ? <Bell size={11} /> : <BellOff size={11} />}
                  </button>
                  <button
                    onClick={() => { setEditandoId(h.id); setEditandoNome(h.nome); }}
                    className="p-1 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => handleExcluir(h.id)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}

              {/* Popup de configuração de lembrete */}
              {configurandoLembreteId === h.id && (
                <div className="absolute z-50 mt-1 p-3 rounded-lg border border-border bg-card shadow-lg space-y-2" style={{ minWidth: '200px' }}>
                  <p className="text-xs font-heading text-foreground">Lembrete para "{h.nome}"</p>
                  <input
                    type="time"
                    value={lembreteHora}
                    onChange={e => setLembreteHora(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSalvarLembrete(h.id)}
                      className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-heading"
                    >
                      Salvar
                    </button>
                    {getReminder(h.id).ativo && (
                      <button
                        onClick={() => handleDesativarLembrete(h.id)}
                        className="py-1.5 px-3 border border-destructive/30 text-destructive rounded-lg text-xs font-heading"
                      >
                        Desativar
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setConfigurandoLembreteId(null)}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Adicionar novo */}
        {adicionando ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { handleAddHabito(); setAdicionando(false); }
                if (e.key === 'Escape') { setAdicionando(false); setNovoNome(''); }
              }}
              onBlur={() => { if (!novoNome.trim()) setAdicionando(false); }}
              placeholder="Nome do hábito..."
              className="w-28 bg-transparent border-b border-muted-foreground text-sm font-body outline-none py-0.5 focus:border-primary"
            />
            <button
              onClick={() => { handleAddHabito(); setAdicionando(false); }}
              disabled={!novoNome.trim()}
              className="p-1 text-primary disabled:opacity-40 transition-colors"
            >
              <Check size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdicionando(true)}
            className="p-1 text-muted-foreground hover:text-primary transition-colors"
            title="Adicionar hábito"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
