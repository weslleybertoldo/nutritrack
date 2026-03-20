import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Eye, Ban, Trash2, ArrowLeft, Lock, Unlock, Settings, User, BarChart3, ChevronLeft, Plus, Pencil, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calcularMetaCalorica, calcularMacros, calcularIdade } from '@/lib/calculations';
import { Profile, NIVEL_ATIVIDADE_OPTIONS } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { generateUserReport } from '@/lib/generateUserReport';
import { FileText } from 'lucide-react';

interface AdminUser {
  id: string;
  user_id: string;
  user_code: number;
  nome: string;
  email: string;
  created_at: string;
  blocked: boolean;
  admin_locked: boolean;
  foto_url: string | null;
  plano_id: string | null;
  plano_inicio: string | null;
  plano_expiracao: string | null;
}

interface AdminPlan {
  id: string;
  nome: string;
  cor: string;
  created_at: string;
}

interface UserDetail {
  profile: any;
  meals: any[];
  weekMeals: any[];
}

async function adminFetch(action: string, params?: Record<string, string>) {
  const token = sessionStorage.getItem('admin_token');
  if (!token) throw new Error('Não autenticado');
  const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-api`);
  url.searchParams.set('action', action);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function adminPost(action: string, body: Record<string, any>) {
  const token = sessionStorage.getItem('admin_token');
  if (!token) throw new Error('Não autenticado');
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// Plan badge helper
function getPlanBadge(user: AdminUser, plans: AdminPlan[]) {
  if (!user.plano_id) return null;
  const plan = plans.find(p => p.id === user.plano_id);
  if (!plan) return null;

  const now = new Date();
  const exp = user.plano_expiracao ? new Date(user.plano_expiracao + 'T23:59:59') : null;

  let bgColor = plan.cor;
  let textColor = '#fff';
  let suffix = '';

  if (exp) {
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      bgColor = '#ef4444';
      suffix = ' · Expirado';
    } else if (diffDays <= 7) {
      bgColor = '#eab308';
      textColor = '#000';
      suffix = ` · Expira em ${diffDays}d`;
    } else {
      const expDate = exp.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      suffix = ` · até ${expDate}`;
    }
  }

  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {plan.nome}{suffix}
    </span>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [selectedTab, setSelectedTab] = useState('info');
  const [editProfile, setEditProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Plan assignment state
  const [userPlanId, setUserPlanId] = useState<string>('');
  const [userPlanInicio, setUserPlanInicio] = useState('');
  const [userPlanExpiracao, setUserPlanExpiracao] = useState('');

  // Settings state
  const [signupStats, setSignupStats] = useState<any[]>([]);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanColor, setNewPlanColor] = useState('#6366f1');
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editPlanName, setEditPlanName] = useState('');
  const [editPlanColor, setEditPlanColor] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    if (token === 'admin-authenticated') setIsAdmin(true);
    else { setIsAdmin(false); navigate('/login'); }
  }, [navigate]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminFetch('list_users');
      setUsers(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const data = await adminFetch('list_plans');
      setPlans(data || []);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) { loadUsers(); loadPlans(); }
  }, [isAdmin, loadUsers, loadPlans]);

  const viewUser = async (userId: string) => {
    try {
      const data = await adminFetch('get_user', { user_id: userId });
      setSelectedUser(data);
      setEditProfile({ ...data.profile });
      setUserPlanId(data.profile.plano_id || '');
      setUserPlanInicio(data.profile.plano_inicio || '');
      setUserPlanExpiracao(data.profile.plano_expiracao || '');
      setSelectedTab('info');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleBlock = async (userId: string) => {
    try {
      const result = await adminPost('toggle_block', { user_id: userId });
      toast.success(result.blocked ? 'Usuário bloqueado' : 'Usuário desbloqueado');
      loadUsers();
      if (selectedUser?.profile.user_id === userId)
        setSelectedUser(prev => prev ? { ...prev, profile: { ...prev.profile, blocked: result.blocked } } : null);
    } catch (err: any) { toast.error(err.message); }
  };

  const toggleLock = async (userId: string) => {
    try {
      const result = await adminPost('toggle_lock', { user_id: userId });
      toast.success(result.admin_locked ? 'Edição bloqueada' : 'Edição liberada');
      loadUsers();
      if (selectedUser?.profile.user_id === userId)
        setSelectedUser(prev => prev ? { ...prev, profile: { ...prev.profile, admin_locked: result.admin_locked } } : null);
    } catch (err: any) { toast.error(err.message); }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await adminPost('delete_user', { user_id: userId });
      toast.success('Usuário excluído');
      setSelectedUser(null);
      loadUsers();
    } catch (err: any) { toast.error(err.message); }
  };

  const saveConfig = async () => {
    if (!editProfile) return;
    try {
      // Compute body composition from skinfold data before saving
      const ep = editProfile;
      const idadeCalc = ep.data_nascimento ? calcularIdade(ep.data_nascimento) : null;
      if (ep.peso && idadeCalc && ep.sexo) {
        let soma3 = 0;
        if (ep.sexo === 'feminino') {
          soma3 = (Number(ep.dc_tricipital) || 0) + (Number(ep.dc_suprailiaca) || 0) + (Number(ep.dc_coxa) || 0);
        } else {
          soma3 = (Number(ep.dc_peitoral) || 0) + (Number(ep.dc_abdominal) || 0) + (Number(ep.dc_coxa) || 0);
        }
        if (soma3 > 0) {
          let densidade: number;
          if (ep.sexo === 'feminino') {
            densidade = 1.0994921 - (0.0009929 * soma3) + (0.0000023 * soma3 * soma3) - (0.0001392 * idadeCalc);
          } else {
            densidade = 1.10938 - (0.0008267 * soma3) + (0.0000016 * soma3 * soma3) - (0.0002574 * idadeCalc);
          }
          const pctGordura = ((4.95 / densidade) - 4.50) * 100;
          const mGorda = ep.peso * (pctGordura / 100);
          const mMagra = ep.peso - mGorda;
          ep.percentual_gordura = Math.round(pctGordura * 10) / 10;
          ep.massa_gorda = Math.round(mGorda * 10) / 10;
          ep.massa_magra = Math.round(mMagra * 10) / 10;
        }
      }
      const { id, user_id, created_at, updated_at, user_code, plano_id, plano_inicio, plano_expiracao, ...profileData } = ep;
      await adminPost('update_profile', { user_id: ep.user_id, data: profileData });
      toast.success('Perfil atualizado');
      viewUser(ep.user_id);
    } catch (err: any) { toast.error(err.message); }
  };

  const savePlan = async () => {
    if (!selectedUser) return;
    try {
      await adminPost('assign_plan', {
        user_id: selectedUser.profile.user_id,
        plano_id: userPlanId || null,
        plano_inicio: userPlanInicio || null,
        plano_expiracao: userPlanExpiracao || null,
      });
      toast.success('Plano atualizado');
      loadUsers();
      viewUser(selectedUser.profile.user_id);
    } catch (err: any) { toast.error(err.message); }
  };

  // Settings handlers
  const openSettings = async () => {
    setShowSettings(true);
    try {
      const data = await adminFetch('signup_stats');
      setSignupStats(data || []);
    } catch (err: any) { toast.error(err.message); }
  };

  const createPlan = async () => {
    if (!newPlanName.trim()) return;
    try {
      await adminPost('create_plan', { nome: newPlanName.trim(), cor: newPlanColor });
      setNewPlanName('');
      setNewPlanColor('#6366f1');
      loadPlans();
      toast.success('Plano criado');
    } catch (err: any) { toast.error(err.message); }
  };

  const updatePlan = async (planId: string) => {
    try {
      await adminPost('update_plan', { plan_id: planId, nome: editPlanName, cor: editPlanColor });
      setEditingPlan(null);
      loadPlans();
      toast.success('Plano atualizado');
    } catch (err: any) { toast.error(err.message); }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Excluir este plano? Usuários com este plano ficarão sem plano.')) return;
    try {
      await adminPost('delete_plan', { plan_id: planId });
      loadPlans();
      toast.success('Plano excluído');
    } catch (err: any) { toast.error(err.message); }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || String(u.user_code).includes(q);
  });

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ========== SETTINGS VIEW ==========
  if (showSettings) {
    // Compute monthly stats
    const monthlyMap: Record<string, { total: number }> = {};
    let totalAtivos = 0;
    let totalBloqueados = 0;
    signupStats.forEach((p: any) => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { total: 0 };
      monthlyMap[key].total++;
      if (p.blocked) totalBloqueados++;
      else totalAtivos++;
    });

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const chartData = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [y, m] = key.split('-');
        return { name: `${monthNames[parseInt(m) - 1]}/${y.slice(2)}`, cadastros: val.total };
      });

    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setShowSettings(false)} className="p-1"><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="font-heading font-bold text-lg">Configurações do Admin</h1>
        </div>

        <div className="p-4 space-y-6">
          {/* Section A: Signup stats */}
          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-base">Estatísticas de Cadastro</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Ativos</p>
                <p className="font-heading font-bold text-xl text-primary">{totalAtivos}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Bloqueados</p>
                <p className="font-heading font-bold text-xl text-destructive">{totalBloqueados}</p>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground mb-2">Evolução mensal</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <Tooltip />
                      <Bar dataKey="cadastros" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Monthly table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Mês/Ano</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Novos cadastros</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {chartData.map(row => (
                    <tr key={row.name}>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.cadastros}</td>
                    </tr>
                  ))}
                  {chartData.length === 0 && (
                    <tr><td colSpan={2} className="px-3 py-4 text-center text-muted-foreground">Sem dados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <hr className="border-border" />

          {/* Section B: Manage Plans */}
          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-base">Gerenciar Planos</h2>

            <div className="space-y-2">
              {plans.map(plan => (
                <div key={plan.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
                  {editingPlan === plan.id ? (
                    <>
                      <input
                        type="color"
                        value={editPlanColor}
                        onChange={e => setEditPlanColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={editPlanName}
                        onChange={e => setEditPlanName(e.target.value)}
                        className="flex-1 h-8 text-sm"
                      />
                      <Button size="sm" variant="ghost" onClick={() => updatePlan(plan.id)} className="h-8 px-2">
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPlan(null)} className="h-8 px-2">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: plan.cor }} />
                      <span className="flex-1 text-sm font-medium">{plan.nome}</span>
                      <Button
                        size="sm" variant="ghost" className="h-8 w-8 p-0"
                        onClick={() => { setEditingPlan(plan.id); setEditPlanName(plan.nome); setEditPlanColor(plan.cor); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => deletePlan(plan.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new plan */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newPlanColor}
                onChange={e => setNewPlanColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <Input
                placeholder="Nome do novo plano"
                value={newPlanName}
                onChange={e => setNewPlanName(e.target.value)}
                className="flex-1 h-9 text-sm"
              />
              <Button size="sm" onClick={createPlan} className="h-9">
                <Plus className="h-4 w-4 mr-1" /> Novo
              </Button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ========== USER DETAIL VIEW ==========
  if (selectedUser) {
    const p = selectedUser.profile;
    const idade = p.data_nascimento ? calcularIdade(p.data_nascimento) : null;

    // Compute body composition on-the-fly if DB values are missing but skinfold data exists
    const computedComposicao = (() => {
      if (!p.peso || !idade || !p.sexo) return null;
      let soma3 = 0;
      if (p.sexo === 'feminino') {
        const t = Number(p.dc_tricipital) || 0;
        const s = Number(p.dc_suprailiaca) || 0;
        const c = Number(p.dc_coxa) || 0;
        soma3 = t + s + c;
      } else {
        const pe = Number(p.dc_peitoral) || 0;
        const a = Number(p.dc_abdominal) || 0;
        const c = Number(p.dc_coxa) || 0;
        soma3 = pe + a + c;
      }
      if (soma3 === 0) return null;
      let densidade: number;
      if (p.sexo === 'feminino') {
        densidade = 1.0994921 - (0.0009929 * soma3) + (0.0000023 * soma3 * soma3) - (0.0001392 * idade);
      } else {
        densidade = 1.10938 - (0.0008267 * soma3) + (0.0000016 * soma3 * soma3) - (0.0002574 * idade);
      }
      const pctGordura = ((4.95 / densidade) - 4.50) * 100;
      const mGorda = p.peso * (pctGordura / 100);
      const mMagra = p.peso - mGorda;
      return {
        percentual_gordura: Math.round(pctGordura * 10) / 10,
        massa_gorda: Math.round(mGorda * 10) / 10,
        massa_magra: Math.round(mMagra * 10) / 10,
      };
    })();

    // Use stored values if available, otherwise use computed
    const displayPercentualGordura = p.percentual_gordura ?? computedComposicao?.percentual_gordura ?? null;
    const displayMassaGorda = p.massa_gorda ?? computedComposicao?.massa_gorda ?? null;
    const displayMassaMagra = p.massa_magra ?? computedComposicao?.massa_magra ?? null;

    const getDaySummary = (meals: any[]) => {
      return meals.reduce((acc: any, meal: any) => {
        (meal.meal_items || []).forEach((item: any) => {
          acc.calorias += Number(item.calorias_calculadas) || 0;
          acc.proteina += Number(item.proteina) || 0;
          acc.carbo += Number(item.carbo) || 0;
          acc.gordura += Number(item.gordura) || 0;
        });
        return acc;
      }, { calorias: 0, proteina: 0, carbo: 0, gordura: 0 });
    };

    const todaySummary = getDaySummary(selectedUser.meals);
    const profileForCalc: Profile = {
      ...p,
      tmb_metodo: p.tmb_metodo || 'mifflin',
      nivel_atividade: p.nivel_atividade || 1.55,
      ajuste_calorico: p.ajuste_calorico || 0,
      objetivo: p.objetivo || 'manter',
      macro_proteina_multiplicador: p.macro_proteina_multiplicador || 2.2,
      macro_gordura_percentual: p.macro_gordura_percentual || 15,
      meta_fibras: p.meta_fibras || 25,
      meta_sodio: p.meta_sodio || 2000,
      meta_acucares: p.meta_acucares || 50,
      meta_gordura_saturada: p.meta_gordura_saturada || 20,
      meta_colesterol: p.meta_colesterol || 300,
      meta_potassio: p.meta_potassio || 3500,
      tema: p.tema || 'system',
    };
    const meta = calcularMetaCalorica(profileForCalc);
    const macros = calcularMacros(profileForCalc, meta.metaFinal);

    const weekDays: { date: string; calorias: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayMeals = (selectedUser.weekMeals || []).filter((m: any) => m.data === dateStr);
      weekDays.push({ date: dateStr, calorias: getDaySummary(dayMeals).calorias });
    }
    const weekTotal = weekDays.reduce((s, d) => s + d.calorias, 0);

    const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
    const labelClass = "text-xs text-muted-foreground mb-1 block";

    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelectedUser(null)} className="p-1"><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-base">{p.nome || p.email}</h1>
            <p className="text-xs text-muted-foreground">ID: {p.user_code} · {p.email}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => generateUserReport(selectedUser)} title="Gerar PDF">
              <FileText className="h-4 w-4 text-primary" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => toggleBlock(p.user_id)} title={p.blocked ? 'Desbloquear' : 'Bloquear'}>
              <Ban className={`h-4 w-4 ${p.blocked ? 'text-destructive' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => toggleLock(p.user_id)} title={p.admin_locked ? 'Liberar edição' : 'Bloquear edição'}>
              {p.admin_locked ? <Lock className="h-4 w-4 text-warning-foreground" /> : <Unlock className="h-4 w-4 text-success" />}
            </Button>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="px-4 pt-3">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="info"><User className="h-3.5 w-3.5 mr-1" />Info</TabsTrigger>
            <TabsTrigger value="diary"><BarChart3 className="h-3.5 w-3.5 mr-1" />Diário</TabsTrigger>
            <TabsTrigger value="config"><Settings className="h-3.5 w-3.5 mr-1" />Config</TabsTrigger>
          </TabsList>

          {/* Info tab */}
          <TabsContent value="info" className="space-y-4 pb-8">
            <section className="space-y-2">
              <h3 className="font-heading font-semibold text-sm">Dados Pessoais</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">Nome:</span><p>{p.nome || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Email:</span><p className="truncate">{p.email}</p></div>
                <div><span className="text-muted-foreground text-xs">Idade:</span><p>{idade ? `${idade} anos` : '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Sexo:</span><p>{p.sexo || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Peso:</span><p>{p.peso ? `${p.peso} kg` : '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Altura:</span><p>{p.altura ? `${p.altura} cm` : '—'}</p></div>
              </div>
            </section>

            <hr className="border-border" />

            <section className="space-y-2">
              <h3 className="font-heading font-semibold text-sm">Composição Corporal</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '% Gordura', value: displayPercentualGordura, unit: '%' },
                  { label: 'M. Gorda', value: displayMassaGorda, unit: 'kg' },
                  { label: 'M. Magra', value: displayMassaMagra, unit: 'kg' },
                ].map(c => (
                  <div key={c.label} className="rounded-lg border border-border bg-card p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">{c.label}</p>
                    <p className="font-heading font-bold text-sm text-primary">{c.value != null ? Number(c.value).toFixed(1) : '—'}</p>
                    {c.value != null && <p className="text-[10px] text-muted-foreground">{c.unit}</p>}
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-border" />

            <section className="space-y-2">
              <h3 className="font-heading font-semibold text-sm">Metas</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">TMB Método:</span><p>{p.tmb_metodo === 'katch' ? 'Katch-McArdle' : 'Mifflin-St Jeor'}</p></div>
                <div><span className="text-muted-foreground text-xs">Nível Atividade:</span><p>×{p.nivel_atividade}</p></div>
                <div><span className="text-muted-foreground text-xs">Objetivo:</span><p>{p.objetivo}</p></div>
                <div><span className="text-muted-foreground text-xs">Ajuste:</span><p>{p.ajuste_calorico} kcal</p></div>
                <div><span className="text-muted-foreground text-xs">Meta Final:</span><p className="font-bold text-primary">{meta.metaFinal} kcal/dia</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Proteína', g: macros.proteina.g, pct: macros.proteina.pct },
                  { label: 'Carbo', g: macros.carbo.g, pct: macros.carbo.pct },
                  { label: 'Gordura', g: macros.gordura.g, pct: macros.gordura.pct },
                ].map(m => (
                  <div key={m.label} className="rounded-lg border border-border bg-card p-2">
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    <p className="font-heading font-bold text-xs">{m.g}g ({m.pct}%)</p>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-border" />

            {/* Plan section */}
            <section className="space-y-3">
              <h3 className="font-heading font-semibold text-sm">Plano</h3>
              <div>
                <label className={labelClass}>Plano</label>
                <select value={userPlanId} onChange={e => setUserPlanId(e.target.value)} className={inputClass}>
                  <option value="">Sem plano</option>
                  {plans.map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.nome}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Data início</label>
                  <input type="date" value={userPlanInicio} onChange={e => setUserPlanInicio(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Data expiração</label>
                  <input type="date" value={userPlanExpiracao} onChange={e => setUserPlanExpiracao(e.target.value)} className={inputClass} />
                </div>
              </div>
              <Button className="w-full" size="sm" onClick={savePlan}>Salvar Plano</Button>
            </section>

            <hr className="border-border" />

            <section className="space-y-2">
              <h3 className="font-heading font-semibold text-sm">Status</h3>
              <div className="flex gap-4 text-sm">
                <span className={`px-2 py-1 rounded text-xs ${p.blocked ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                  {p.blocked ? '🔴 Bloqueado' : '🟢 Ativo'}
                </span>
                <span className={`px-2 py-1 rounded text-xs ${p.admin_locked ? 'bg-warning/10 text-warning-foreground' : 'bg-success/10 text-success'}`}>
                  {p.admin_locked ? '🔒 Edição bloqueada' : '🔓 Edição livre'}
                </span>
              </div>
            </section>
          </TabsContent>

          {/* Diary tab */}
          <TabsContent value="diary" className="space-y-4 pb-8">
            <section className="space-y-2">
              <h3 className="font-heading font-semibold text-sm">Hoje</h3>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Calorias consumidas</p>
                <p className="font-heading text-2xl font-bold">{Math.round(todaySummary.calorias)} <span className="text-sm text-muted-foreground">/ {meta.metaFinal} kcal</span></p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Proteína', value: todaySummary.proteina, goal: macros.proteina.g },
                  { label: 'Carbo', value: todaySummary.carbo, goal: macros.carbo.g },
                  { label: 'Gordura', value: todaySummary.gordura, goal: macros.gordura.g },
                ].map(m => (
                  <div key={m.label} className="rounded-lg border border-border bg-card p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    <p className="font-heading font-bold text-sm">{Math.round(m.value)}g</p>
                    <p className="text-[10px] text-muted-foreground">/ {m.goal}g</p>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-border" />

            <section className="space-y-2">
              <h3 className="font-heading font-semibold text-sm">Últimos 7 dias</h3>
              <div className="flex items-end gap-1 h-32">
                {weekDays.map((d, i) => {
                  const maxCal = Math.max(...weekDays.map(w => w.calorias), meta.metaFinal);
                  const height = maxCal > 0 ? (d.calorias / maxCal) * 100 : 0;
                  const dayName = new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-muted-foreground">{Math.round(d.calorias)}</span>
                      <div className="w-full flex items-end" style={{ height: '80px' }}>
                        <div
                          className={`w-full rounded-t ${d.calorias > meta.metaFinal ? 'bg-destructive/70' : 'bg-primary/70'}`}
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{dayName}</span>
                    </div>
                  );
                })}
              </div>
              <div className="text-center text-sm">
                <span className="text-muted-foreground">Total semanal: </span>
                <span className="font-bold">{Math.round(weekTotal)} kcal</span>
                <span className="text-muted-foreground"> · Média: </span>
                <span className="font-bold">{Math.round(weekTotal / 7)} kcal/dia</span>
              </div>
            </section>
          </TabsContent>

          {/* Config tab */}
          <TabsContent value="config" className="space-y-4 pb-8">
            {editProfile && (
              <>
                <section className="space-y-3">
                  <h3 className="font-heading font-semibold text-sm">Dados Pessoais</h3>
                  <div>
                    <label className={labelClass}>Nome</label>
                    <input value={editProfile.nome || ''} onChange={e => setEditProfile({ ...editProfile, nome: e.target.value })} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Peso (kg)</label>
                      <input type="number" value={editProfile.peso || ''} onChange={e => setEditProfile({ ...editProfile, peso: Number(e.target.value) || null })} className={inputClass} step="0.1" />
                    </div>
                    <div>
                      <label className={labelClass}>Altura (cm)</label>
                      <input type="number" value={editProfile.altura || ''} onChange={e => setEditProfile({ ...editProfile, altura: Number(e.target.value) || null })} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Data nascimento</label>
                      <input type="date" value={editProfile.data_nascimento || ''} onChange={e => setEditProfile({ ...editProfile, data_nascimento: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Sexo</label>
                      <select value={editProfile.sexo || ''} onChange={e => setEditProfile({ ...editProfile, sexo: e.target.value })} className={inputClass}>
                        <option value="">—</option>
                        <option value="masculino">Masculino</option>
                        <option value="feminino">Feminino</option>
                      </select>
                    </div>
                  </div>
                </section>

                <hr className="border-border" />

                <section className="space-y-3">
                  <h3 className="font-heading font-semibold text-sm">Dobras Cutâneas (mm)</h3>
                  <p className="text-xs text-muted-foreground">
                    Protocolo Jackson & Pollock — 3 dobras
                    {editProfile.sexo === 'feminino' ? ' · Tríceps, Supra-ilíaca, Coxa' : ' · Peitoral, Abdominal, Coxa'}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {(editProfile.sexo === 'feminino'
                      ? [['dc_tricipital', 'Tríceps'], ['dc_suprailiaca', 'Supra-ilíaca'], ['dc_coxa', 'Coxa']]
                      : [['dc_peitoral', 'Peitoral'], ['dc_abdominal', 'Abdominal'], ['dc_coxa', 'Coxa']]
                    ).map(([key, label]) => (
                      <div key={key}>
                        <label className={labelClass}>{label}</label>
                        <input type="number" value={editProfile[key] || ''} onChange={e => setEditProfile({ ...editProfile, [key]: Number(e.target.value) || null })} className={inputClass} step="0.1" />
                      </div>
                    ))}
                  </div>
                </section>

                <hr className="border-border" />

                <section className="space-y-3">
                  <h3 className="font-heading font-semibold text-sm">Metas Calóricas</h3>
                  <div>
                    <label className={labelClass}>TMB Método</label>
                    <select value={editProfile.tmb_metodo || 'mifflin'} onChange={e => setEditProfile({ ...editProfile, tmb_metodo: e.target.value })} className={inputClass}>
                      <option value="mifflin">Mifflin-St Jeor</option>
                      <option value="katch">Katch-McArdle</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Nível de Atividade</label>
                    <select value={editProfile.nivel_atividade || 1.55} onChange={e => setEditProfile({ ...editProfile, nivel_atividade: Number(e.target.value) })} className={inputClass}>
                      {NIVEL_ATIVIDADE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label} (×{o.value})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Multiplicador Proteína</label>
                      <input type="number" value={editProfile.macro_proteina_multiplicador || 2.2} onChange={e => setEditProfile({ ...editProfile, macro_proteina_multiplicador: Number(e.target.value) })} className={inputClass} step="0.1" />
                    </div>
                    <div>
                      <label className={labelClass}>% Gordura</label>
                      <input type="number" value={editProfile.macro_gordura_percentual || 15} onChange={e => setEditProfile({ ...editProfile, macro_gordura_percentual: Number(e.target.value) })} className={inputClass} step="1" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Objetivo</label>
                    <select value={editProfile.objetivo || 'manter'} onChange={e => setEditProfile({ ...editProfile, objetivo: e.target.value })} className={inputClass}>
                      <option value="perder">Perder peso</option>
                      <option value="manter">Manter</option>
                      <option value="ganhar">Ganhar peso</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Ajuste calórico (kcal)</label>
                    <input type="number" value={editProfile.ajuste_calorico || 0} onChange={e => setEditProfile({ ...editProfile, ajuste_calorico: Number(e.target.value) })} className={inputClass} step="50" />
                  </div>
                </section>

                <hr className="border-border" />

                <section className="space-y-3">
                  <h3 className="font-heading font-semibold text-sm">Metas de Micronutrientes</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['meta_fibras', 'Fibras (g)'],
                      ['meta_sodio', 'Sódio (mg)'],
                      ['meta_acucares', 'Açúcares (g)'],
                      ['meta_gordura_saturada', 'Gord. Saturada (g)'],
                      ['meta_colesterol', 'Colesterol (mg)'],
                      ['meta_potassio', 'Potássio (mg)'],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <label className={labelClass}>{label}</label>
                        <input type="number" value={editProfile[key] || ''} onChange={e => setEditProfile({ ...editProfile, [key]: Number(e.target.value) || 0 })} className={inputClass} step="1" />
                      </div>
                    ))}
                  </div>
                </section>

                <Button className="w-full" onClick={saveConfig}>Salvar Configurações</Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ========== USER LIST VIEW ==========
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-heading font-bold text-lg">Painel Admin</h1>
            <p className="text-xs text-muted-foreground">{users.length} usuários cadastrados</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={openSettings} title="Configurações">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, email ou ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map(u => (
            <div key={u.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{u.nome || 'Sem nome'}</p>
                  {getPlanBadge(u, plans)}
                  {u.blocked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Bloqueado</span>}
                  {u.admin_locked && <Lock className="h-3 w-3 text-warning-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                <p className="text-[10px] text-muted-foreground">
                  ID: {u.user_code} · {new Date(u.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewUser(u.user_id)} title="Visualizar">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
                  try {
                    toast.info('Gerando PDF...');
                    const data = await adminFetch('get_user', { user_id: u.user_id });
                    generateUserReport(data);
                  } catch (err: any) { toast.error(err.message); }
                }} title="Gerar PDF">
                  <FileText className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleBlock(u.user_id)} title={u.blocked ? 'Desbloquear' : 'Bloquear'}>
                  <Ban className={`h-4 w-4 ${u.blocked ? 'text-destructive' : ''}`} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteUser(u.user_id)} title="Excluir">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum usuário encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
