import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPwaPrompt, clearPwaPrompt, subscribePwaPrompt, isStandalone } from '@/lib/pwa';

export default function InstallBanner() {
  const [show, setShow] = useState(false);

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

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
      <div className="flex items-center gap-3 rounded-xl bg-card border border-border p-3 shadow-lg">
        <Download className="h-5 w-5 text-primary shrink-0" />
        <p className="flex-1 text-sm font-body">
          Instale o NutriTrack na sua tela inicial!
        </p>
        <Button size="sm" onClick={handleInstall} className="shrink-0">
          Instalar
        </Button>
        <button onClick={handleDismiss} className="p-1 text-muted-foreground shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
