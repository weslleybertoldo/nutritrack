import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, Pencil, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

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

  const loadHabitos = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('habitos')
      .select('id, nome, ordem')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .order('ordem');
    if (data) setHabitos(data as Habito[]);
    setLoading(false);
  }, [user]);

  const loadConcluidos = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('habitos_registro')
      .select('habito_id')
      .eq('user_id', user.id)
      .eq('data', selectedDate);
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
        .then(({ data }) => { if (data) setHabitos([data as Habito]); });
    }
  }, [loading, habitos.length, user]);

  const handleToggle = async (habitoId: string) => {
    if (!user) return;
    const jaConcluido = concluidos.has(habitoId);
    if (jaConcluido) {
      await supabase.from('habitos_registro')
        .delete()
        .eq('user_id', user.id)
        .eq('habito_id', habitoId)
        .eq('data', selectedDate);
      setConcluidos(prev => { const s = new Set(prev); s.delete(habitoId); return s; });
    } else {
      await supabase.from('habitos_registro')
        .insert({ user_id: user.id, habito_id: habitoId, data: selectedDate });
      setConcluidos(prev => new Set([...prev, habitoId]));
    }
  };

  const handleAddHabito = async () => {
    if (!novoNome.trim() || !user) return;
    const maxOrdem = habitos.length > 0 ? Math.max(...habitos.map(h => h.ordem)) + 1 : 0;
    const { data } = await supabase.from('habitos')
      .insert({ user_id: user.id, nome: novoNome.trim(), ordem: maxOrdem, ativo: true })
      .select('id, nome, ordem').single();
    if (data) {
      setHabitos(prev => [...prev, data as Habito]);
      setNovoNome('');
      toast.success(`"${(data as Habito).nome}" adicionado!`);
    }
  };

  const handleRenomear = async (id: string) => {
    if (!editandoNome.trim()) return;
    await supabase.from('habitos').update({ nome: editandoNome.trim() }).eq('id', id);
    setHabitos(prev => prev.map(h => h.id === id ? { ...h, nome: editandoNome.trim() } : h));
    setEditandoId(null);
  };

  const handleExcluir = async (id: string) => {
    await supabase.from('habitos').update({ ativo: false }).eq('id', id);
    setHabitos(prev => prev.filter(h => h.id !== id));
    setConcluidos(prev => { const s = new Set(prev); s.delete(id); return s; });
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
                </button>
              )}
              {editando && editandoId !== h.id && (
                <div className="flex gap-0.5">
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
            </div>
          );
        })}

        {/* Adicionar novo — clica no + para abrir input inline */}
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
