import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Tema } from '@/types';
import { LogOut, Moon, Sun, Monitor, Download, CheckCircle2, Smartphone, Share2, X, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getPwaPrompt, clearPwaPrompt, subscribePwaPrompt, isStandalone } from '@/lib/pwa';

export default function SettingsPage() {
  const { tema, setTema } = useTheme();
  const { profile } = useApp();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [installed, setInstalled] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(false);
  const [showShareFallback, setShowShareFallback] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareData = {
    title: 'NutriTrack',
    text: 'Acompanhe sua alimentação e macronutrientes com o NutriTrack!',
    url: 'https://nutri-spark-hub-46.lovable.app',
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled
      }
    } else {
      setShowShareFallback(true);
    }
  };

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareData.url);
    setCopied(true);
    toast.success('Link copiado!');
    // Cleanup anterior antes de criar novo timer
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    setInstalled(isStandalone());
    setHasPrompt(!!getPwaPrompt());
    return subscribePwaPrompt(() => {
      setHasPrompt(!!getPwaPrompt());
      setInstalled(isStandalone());
    });
  }, []);

  const handleInstall = async () => {
    const prompt = getPwaPrompt();
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    clearPwaPrompt();
    setHasPrompt(false);
  };

  const temaOptions: { value: Tema; label: string; icon: React.ElementType }[] = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <AppLayout title="Configurações">
      <div className="space-y-6 pb-8">
        {/* Install App */}
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Instalar App
          </h2>
          {installed ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm font-body text-primary">
              <CheckCircle2 className="h-5 w-5" />
              App já instalado
            </div>
          ) : hasPrompt ? (
            <Button onClick={handleInstall} className="w-full gap-2">
              <Download className="h-4 w-4" />
              📲 Instalar NutriTrack
            </Button>
          ) : (
            <div className="rounded-lg border border-input p-3 space-y-2">
              <p className="text-sm font-body text-muted-foreground">
                Instale manualmente:
              </p>
              <div className="space-y-1.5 text-xs text-muted-foreground font-body">
                <p><strong className="text-foreground">Android Chrome:</strong> Toque no menu ⋮ → Adicionar à tela inicial</p>
                <p><strong className="text-foreground">iPhone Safari:</strong> Toque em compartilhar ↗ → Adicionar à Tela de Início</p>
              </div>
            </div>
          )}
        </section>

        <hr className="border-border" />

        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-base">Tema</h2>
          <div className="flex gap-2">
            {temaOptions.map(t => (
              <button
                key={t.value}
                className={`flex-1 flex flex-col items-center gap-1.5 rounded-lg border py-3 text-sm font-body transition-colors ${
                  tema === t.value ? 'border-primary bg-primary/10 font-medium' : 'border-input hover:bg-secondary'
                }`}
                onClick={() => setTema(t.value)}
              >
                <t.icon className="h-5 w-5" />
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <hr className="border-border" />

        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-base">Atalhos</h2>
          <div className="space-y-2">
            <button
              className="w-full rounded-lg border border-input p-3 text-left text-sm font-body hover:bg-secondary transition-colors"
              onClick={() => navigate('/perfil')}
            >
              Editar perfil e dados pessoais
            </button>
            <button
              className="w-full rounded-lg border border-input p-3 text-left text-sm font-body hover:bg-secondary transition-colors"
              onClick={() => navigate('/metas')}
            >
              Alterar meta calórica e macros
            </button>
          </div>
        </section>

        <hr className="border-border" />

        {/* Share App */}
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Compartilhar App
          </h2>
          <Button variant="outline" className="w-full gap-2" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            Compartilhar NutriTrack
          </Button>
        </section>

        <hr className="border-border" />

        <section>
          <p className="text-sm text-muted-foreground mb-3">
            {profile.nome || 'Usuário'} · {user?.email || profile.email || 'Sem email'}
          </p>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-destructive/30 px-4 py-2.5 text-sm font-body text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </section>
      </div>

      {/* Share fallback modal for desktop */}
      {showShareFallback && (
        <div className="modal-overlay flex items-center justify-center">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setShowShareFallback(false)} />
          <div className="relative bg-card rounded-2xl p-6 mx-4 max-w-sm w-full space-y-4 shadow-lg animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold">Compartilhar NutriTrack</h3>
              <button onClick={() => setShowShareFallback(false)} className="p-1 text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex gap-3">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${shareData.text} ${shareData.url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex flex-col items-center gap-1.5 rounded-lg border border-input py-3 text-sm font-body hover:bg-secondary transition-colors"
              >
                <svg className="h-6 w-6 text-[hsl(142,70%,45%)]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.text)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex flex-col items-center gap-1.5 rounded-lg border border-input py-3 text-sm font-body hover:bg-secondary transition-colors"
              >
                <svg className="h-6 w-6 text-[hsl(200,80%,50%)]" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.96 6.504-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </a>
              <button
                onClick={handleCopyLink}
                className="flex-1 flex flex-col items-center gap-1.5 rounded-lg border border-input py-3 text-sm font-body hover:bg-secondary transition-colors"
              >
                {copied ? <Check className="h-6 w-6 text-primary" /> : <Copy className="h-6 w-6 text-muted-foreground" />}
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
