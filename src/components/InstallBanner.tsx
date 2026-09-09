import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPwaPrompt, clearPwaPrompt, subscribePwaPrompt, isStandalone } from '@/lib/pwa';
import { useDelayedUnmount } from '@/hooks/useSheet';

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  // Fica montado 220ms depois de fechar pra animação de saída rodar.
  const mounted = useDelayedUnmount(show, 220);

  useEffect(() => {
    if (localStorage.getItem('pwa-install-dismissed')) return;
    if (isStandalone()) return;

    const check = () => setShow(!!getPwaPrompt());
    check();
    return subscribePwaPrompt(check);
  }, []);

  const handleInstall = async () => {
    const prompt = getPwaPrompt();
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-install-dismissed', '1');
    }
    clearPwaPrompt();
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', '1');
    setShow(false);
  };

  if (!mounted) return null;

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 z-50 ${
        show
          ? 'animate-in slide-in-from-bottom-4 fade-in-0 duration-300'
          : 'animate-out slide-out-to-bottom-4 fade-out-0 duration-200 fill-mode-forwards'
      }`}
    >
      <div className="flex items-center gap-3 rounded-none bg-card border border-border p-3 shadow-lg">
        <Download className="h-5 w-5 text-primary shrink-0" />
        <p className="flex-1 text-sm font-body">
          Instale o NutriTrack na sua tela inicial!
        </p>
        <Button size="sm" onClick={handleInstall} className="shrink-0">
          Instalar
        </Button>
        <button type="button" onClick={handleDismiss} aria-label="Fechar" className="pressable-sm p-1 text-muted-foreground shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
