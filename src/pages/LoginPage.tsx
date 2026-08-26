import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { signInWithGoogle } from '@/lib/capacitorAuth';
import { toast } from 'sonner';
import { RefreshCw, Eye, EyeOff } from 'lucide-react';
import { CURRENT_VERSION } from '@/components/UpdateChecker';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
      const result = await signInWithGoogle();
      if (result.error) {
        toast.error(result.error);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar com Google');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckUpdate = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 relative">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl text-foreground tracking-tight">
            NUTRI<span className="text-primary">TRACK</span>
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-2">
            {isSignUp ? 'Crie sua conta' : 'Entre na sua conta'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full h-12 border border-muted-foreground/30 text-foreground font-body text-sm flex items-center justify-center gap-3 hover:bg-secondary transition-colors duration-200 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Entrar com Google
        </button>

        <div className="flex items-center gap-4">
          <div className="flex-1 border-t border-muted-foreground/30" />
          <span className="text-xs text-muted-foreground font-body uppercase">ou</span>
          <div className="flex-1 border-t border-muted-foreground/30" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-5">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-body mb-2 block">Email</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-underline"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-body mb-2 block">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-underline pr-10"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-primary-foreground font-heading text-sm uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground font-body">
          {isSignUp ? 'Já tem conta?' : 'Não tem conta?'}{' '}
          <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline">
            {isSignUp ? 'Entrar' : 'Criar conta'}
          </button>
        </p>

        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground font-body italic">By Weslley Bertoldo</p>
          <p className="text-[10px] text-muted-foreground/50 font-body">v{CURRENT_VERSION}</p>
          <button
            type="button"
            onClick={handleCheckUpdate}
            className="text-[10px] text-muted-foreground/60 hover:text-primary font-body transition-colors flex items-center justify-center gap-1 mx-auto"
          >
            <RefreshCw size={10} />
            Verificar atualizações
          </button>
        </div>
      </div>
    </div>
  );
}
