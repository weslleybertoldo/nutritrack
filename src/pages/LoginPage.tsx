import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Settings } from 'lucide-react';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('Conta criada! Verifique seu email para confirmar.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Check if user is blocked
        if (data.user) {
          const { data: profile } = await supabase.from('profiles').select('blocked').eq('user_id', data.user.id).single();
          if (profile?.blocked) {
            await supabase.auth.signOut();
            toast.error('Conta suspensa. Entre em contato com o administrador.');
            return;
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro na autenticação');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result && 'error' in result && result.error) {
        throw result.error;
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar com Google');
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-api', {
        body: { action: 'login', username: adminUsername, password: adminPassword },
      });

      if (error) {
        toast.error('Erro ao conectar com o servidor');
        return;
      }

      if (data?.success) {
        sessionStorage.setItem('admin_token', 'admin-authenticated');
        setShowAdminModal(false);
        navigate('/admin');
      } else {
        toast.error(data?.error || 'Credenciais inválidas');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro na autenticação');
    } finally {
      setAdminLoading(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold text-primary">NutriTrack</h1>
          <p className="text-sm text-muted-foreground mt-1 font-body">
            Acompanhamento nutricional inteligente
          </p>
        </div>

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Entrar com Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">ou</span></div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputClass}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={inputClass}
            required
            minLength={6}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? 'Já tem conta?' : 'Não tem conta?'}{' '}
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary font-medium hover:underline">
            {isSignUp ? 'Entrar' : 'Criar conta'}
          </button>
        </p>
      </div>

      {/* Admin gear icon */}
      <button
        onClick={() => setShowAdminModal(true)}
        className="absolute bottom-6 right-6 p-2 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
        title="Admin"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Admin login modal */}
      {showAdminModal && (
        <div className="modal-overlay">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setShowAdminModal(false)} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="text-center">
              <Settings className="h-8 w-8 text-primary mx-auto mb-2" />
              <h2 className="font-heading font-bold text-lg">Acesso Administrativo</h2>
              <p className="text-xs text-muted-foreground">Entre com suas credenciais de admin</p>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input
                type="text"
                placeholder="Usuário"
                value={adminUsername}
                onChange={e => setAdminUsername(e.target.value)}
                className={inputClass}
                required
              />
              <input
                type="password"
                placeholder="Senha"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                className={inputClass}
                required
              />
              <Button type="submit" className="w-full" disabled={adminLoading}>
                {adminLoading ? 'Verificando...' : 'Entrar como Admin'}
              </Button>
            </form>
            <button onClick={() => setShowAdminModal(false)} className="w-full text-center text-sm text-muted-foreground hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
