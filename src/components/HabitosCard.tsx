import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Check, Pencil, Trash2, X, Bell, BellOff } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  getReminder,
  setReminder,
  removeReminder,
  scheduleHabitNotification,
  cancelHabitNotification,
  onHabitCompleted,
  createHabitReminderChannel,
  reconcileHabitNotifications,
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

  // Inicializa com creatina se não tiver nenhum.
  // Guard por user.id: roda no máximo 1x por usuário, mesmo que o objeto `user`
  // ou `habitos` oscilem — evita inserts concorrentes de "Creatina" duplicada.
  const initTriedForUser = useRef<string | null>(null);
  useEffect(() => {
    if (loading || habitos.length > 0 || !user) return;
    if (initTriedForUser.current === user.id) return;
    initTriedForUser.current = user.id;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('habitos')
          .insert({ user_id: user.id, nome: 'Creatina', ordem: 0, ativo: true })
          .select('id, nome, ordem')
          .single();
        if (cancelled) return;
        if (error) {
          // 23505 = já existe (corrida): apenas recarrega em vez de duplicar
          console.warn('[HabitosCard] Erro ao criar hábito padrão:', error.message);
          loadHabitos();
          return;
        }
        if (data) setHabitos([data as Habito]);
      } catch (e) {
        if (cancelled) return;
        console.error('[HabitosCard] Erro inesperado ao criar hábito padrão:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, habitos.length, user, loadHabitos]);

  // Reconcilia lembretes salvos com o que o SO tem agendado (recupera
  // agendamentos perdidos). Roda quando a lista de hábitos carrega.
  useEffect(() => {
    if (habitos.length === 0) return;
    // fire-and-forget: captura erro pra não virar unhandled rejection se algum
    // plugin/bridge nativo lançar.
    reconcileHabitNotifications(habitos).catch(e =>
      console.warn('[HabitosCard] Falha ao reconciliar lembretes:', e));
  }, [habitos]);

  // Marcar/desmarcar é OTIMISTA: o chip muda na hora do toque; a rede vai
  // depois e, se falhar, volta atrás com aviso. Antes o toque esperava a
  // resposta do servidor (300–800ms no celular) e parecia "travado".
  const handleToggle = async (habitoId: string) => {
    if (!user) return;
    const habito = habitos.find(h => h.id === habitoId);
    const jaConcluido = concluidos.has(habitoId);
    const aplicar = (marcado: boolean) => setConcluidos(prev => {
      const s = new Set(prev);
      if (marcado) s.add(habitoId); else s.delete(habitoId);
      return s;
    });
    aplicar(!jaConcluido);

    if (jaConcluido) {
      const { error } = await supabase.from('habitos_registro')
        .delete()
        .eq('user_id', user.id)
        .eq('habito_id', habitoId)
        .eq('data', selectedDate);
      if (error) { console.warn('Erro ao desmarcar hábito:', error.message); aplicar(true); toast.error('Erro ao desmarcar hábito'); return; }

      // Voltou a ficar pendente → se tem lembrete ativo, reagenda (o completar
      // havia cancelado a de hoje e jogado pra amanhã). Sem isto, marcar+desmarcar
      // deixava o dia sem lembrete.
      if (habito) {
        const reminder = getReminder(habitoId);
        if (reminder.ativo) scheduleHabitNotification(habitoId, habito.nome, reminder.hora, reminder.minuto);
      }
    } else {
      const { error } = await supabase.from('habitos_registro')
        .insert({ user_id: user.id, habito_id: habitoId, data: selectedDate });
      // 23505 = já estava marcado (outro aparelho): mantém marcado.
      if (error && error.code !== '23505') { console.warn('Erro ao marcar hábito:', error.message); aplicar(false); toast.error('Erro ao marcar hábito'); return; }

      // Hábito concluído → cancela notificação de hoje e reagenda para amanhã
      if (habito) {
        onHabitCompleted(habitoId, habito.nome);
      }
    }
  };

  // Trava reentrância: o add é disparado por Enter e pelo botão; sem esta trava
  // dois gatilhos rápidos inseriam o mesmo nome duas vezes.
  const addingRef = useRef(false);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const handleAddHabito = async () => {
    const nome = novoNome.trim();
    if (!nome || !user || addingRef.current) return;
    addingRef.current = true;
    setSalvandoNovo(true);
    try {
      const maxOrdem = habitos.length > 0 ? Math.max(...habitos.map(h => h.ordem)) + 1 : 0;
      const { data, error } = await supabase.from('habitos')
        .insert({ user_id: user.id, nome, ordem: maxOrdem, ativo: true })
        .select('id, nome, ordem').single();
      if (error) {
        if (error.code === '23505') {
          toast.error('Você já tem um hábito com esse nome');
          loadHabitos();
        } else {
          console.warn('Erro ao adicionar hábito:', error.message);
          toast.error('Erro ao adicionar hábito');
        }
        return;
      }
      if (data) {
        setHabitos(prev => prev.some(h => h.id === (data as Habito).id) ? prev : [...prev, data as Habito]);
        setNovoNome('');
        toast.success(`"${(data as Habito).nome}" adicionado!`);
      }
    } finally {
      addingRef.current = false;
      setSalvandoNovo(false);
    }
  };

  const handleRenomear = async (id: string) => {
    if (!editandoNome.trim()) return;
    const novo = editandoNome.trim();
    const anterior = habitos.find(h => h.id === id)?.nome;
    // Otimista: renomeia na tela e fecha o campo na hora.
    setHabitos(prev => prev.map(h => h.id === id ? { ...h, nome: novo } : h));
    setEditandoId(null);
    const { error } = await supabase.from('habitos').update({ nome: novo }).eq('id', id);
    if (error) {
      console.warn('Erro ao renomear hábito:', error.message);
      if (anterior) setHabitos(prev => prev.map(h => h.id === id ? { ...h, nome: anterior } : h));
      toast.error('Erro ao renomear hábito');
      return;
    }

    // Se tem lembrete ativo, reagenda com novo nome
    const reminder = getReminder(id);
    if (reminder.ativo) {
      scheduleHabitNotification(id, novo, reminder.hora, reminder.minuto);
    }
  };

  const handleExcluir = async (id: string) => {
    const removido = habitos.find(h => h.id === id);
    const estavaConcluido = concluidos.has(id);
    // Otimista: some da tela na hora.
    setHabitos(prev => prev.filter(h => h.id !== id));
    setConcluidos(prev => { const s = new Set(prev); s.delete(id); return s; });
    const { error } = await supabase.from('habitos').update({ ativo: false }).eq('id', id);
    if (error) {
      console.warn('Erro ao excluir hábito:', error.message);
      if (removido) setHabitos(prev => [...prev, removido].sort((a, b) => a.ordem - b.ordem));
      if (estavaConcluido) setConcluidos(prev => new Set([...prev, id]));
      toast.error('Erro ao excluir hábito');
      return;
    }

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

    const scheduled = await scheduleHabitNotification(habitoId, habito.nome, h, m);
    // Em app nativo, só marca o lembrete como ativo se a notificação realmente
    // foi agendada. Sem isso, o sino ficava aceso mas nada tocava (permissão
    // negada). Na web (sem suporte a notificação) mantém como preferência.
    if (Capacitor.isNativePlatform() && !scheduled) {
      // scheduled=false cobre permissão negada E erro de agendamento — msg genérica.
      toast.error('Não foi possível agendar o lembrete. Verifique as permissões de notificação do app.');
      return;
    }
    setReminder(habitoId, h, m, true);
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

  // Esqueleto com o mesmo tamanho do card: nada pula quando os hábitos chegam.
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card mb-3" aria-busy="true">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-heading font-semibold text-sm">Hábitos diários</span>
          <Spinner size={14} label="Carregando hábitos" />
        </div>
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24 rounded-none" />
          <Skeleton className="h-8 w-20 rounded-none" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card mb-3 fade-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-heading font-semibold text-sm">Hábitos diários</span>
        <button
          type="button"
          onClick={() => setEditando(e => !e)}
          className="pressable text-xs text-muted-foreground hover:text-foreground font-heading px-1"
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
                <div className="flex items-center gap-1 fade-enter">
                  <input
                    autoFocus
                    value={editandoNome}
                    onChange={e => setEditandoNome(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenomear(h.id); if (e.key === 'Escape') setEditandoId(null); }}
                    className="w-24 bg-transparent border-b border-primary text-sm font-body outline-none py-0.5"
                  />
                  <button type="button" onClick={() => handleRenomear(h.id)} aria-label="Salvar nome" className="pressable-sm text-primary"><Check size={12} /></button>
                  <button type="button" onClick={() => setEditandoId(null)} aria-label="Cancelar" className="pressable-sm text-muted-foreground"><X size={12} /></button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => !editando && handleToggle(h.id)}
                  aria-pressed={feito}
                  className={`pressable flex items-center gap-1.5 px-3 py-1.5 rounded-none text-xs font-heading uppercase tracking-wider ${
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
                <div className="flex gap-0.5 fade-enter">
                  <Popover
                    open={configurandoLembreteId === h.id}
                    onOpenChange={(o) => { if (!o) setConfigurandoLembreteId(null); }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleAbrirLembrete(h.id)}
                        className={`pressable-sm p-1 ${
                          reminder.ativo
                            ? 'text-primary hover:text-primary/80'
                            : 'text-muted-foreground hover:text-primary'
                        }`}
                        title={reminder.ativo ? `Lembrete: ${String(reminder.hora).padStart(2, '0')}:${String(reminder.minuto).padStart(2, '0')}` : 'Configurar lembrete'}
                        aria-label="Lembrete"
                      >
                        {reminder.ativo ? <Bell size={11} /> : <BellOff size={11} />}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" sideOffset={6} className="z-[150] w-60 space-y-2 rounded-lg border-border bg-card p-3 shadow-lg">
                      <p className="text-xs font-heading text-foreground">Lembrete para "{h.nome}"</p>
                      <input
                        type="time"
                        value={lembreteHora}
                        onChange={e => setLembreteHora(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSalvarLembrete(h.id)}
                          className="pressable flex-1 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-heading"
                        >
                          Salvar
                        </button>
                        {getReminder(h.id).ativo && (
                          <button
                            type="button"
                            onClick={() => handleDesativarLembrete(h.id)}
                            className="pressable py-1.5 px-3 border border-destructive/30 text-destructive rounded-lg text-xs font-heading"
                          >
                            Desativar
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfigurandoLembreteId(null)}
                        className="pressable w-full text-center text-xs text-muted-foreground hover:text-foreground py-0.5"
                      >
                        Cancelar
                      </button>
                    </PopoverContent>
                  </Popover>
                  <button
                    type="button"
                    onClick={() => { setEditandoId(h.id); setEditandoNome(h.nome); }}
                    aria-label="Renomear"
                    className="pressable-sm p-1 text-muted-foreground hover:text-primary"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluir(h.id)}
                    aria-label="Excluir hábito"
                    className="pressable-sm p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Adicionar novo */}
        {adicionando ? (
          <div className="flex items-center gap-1 fade-enter">
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
              type="button"
              onClick={() => { handleAddHabito(); setAdicionando(false); }}
              disabled={!novoNome.trim() || salvandoNovo}
              aria-label="Adicionar hábito"
              className="pressable-sm p-1 text-primary disabled:opacity-40"
            >
              {salvandoNovo ? <Spinner size={12} /> : <Check size={12} />}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="pressable-sm p-1 text-muted-foreground hover:text-primary"
            title="Adicionar hábito"
            aria-label="Adicionar hábito"
          >
            {salvandoNovo ? <Spinner size={14} /> : <Plus size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
