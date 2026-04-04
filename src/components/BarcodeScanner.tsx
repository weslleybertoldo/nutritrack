import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BarcodeScannerProps {
  onScanned: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanned, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const cleanup = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (scannerRef.current) {
      try { scannerRef.current.stop().catch(() => {}); } catch {}
      try { scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      cleanup();
      onScanned(manualCode.trim());
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let scanner: Html5Qrcode | null = null;

    const start = async () => {
      // 12s timeout (dispositivos lentos podem demorar para iniciar câmera)
      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current && !error) {
          setError('Câmera não carregou. Tente digitar manualmente.');
        }
      }, 12000);

      // Explicit permission request
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(t => t.stop());
      } catch (err: any) {
        console.error('[BarcodeScanner] Camera permission error:', err?.name, err?.message);
        if (!mountedRef.current) return;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Permissão de câmera negada. Ative nas configurações do aparelho.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('Nenhuma câmera encontrada neste dispositivo.');
        } else {
          setError('Não foi possível acessar a câmera. Tente digitar manualmente.');
        }
        return;
      }

      if (!mountedRef.current) return;

      const scannerId = 'barcode-scanner-region';
      const el = document.getElementById(scannerId);
      if (!el) return;

      try {
        scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            try { scanner?.stop().catch(() => {}); } catch {}
            scannerRef.current = null;
            onScanned(decodedText);
          },
          () => {} // Callback a cada frame sem detecção — esperado
        );

        // Clear timeout on successful start
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      } catch (scanErr: any) {
        console.error('[BarcodeScanner] Scanner start error:', scanErr?.message || scanErr);
        if (mountedRef.current) {
          setError('Erro ao iniciar o scanner. Tente digitar manualmente.');
        }
      }
    };

    start();

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (scanner) {
        try { scanner.stop().catch(() => {}); } catch {}
        try { scanner.clear(); } catch {}
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent clicks from propagating to parent modals
  return (
    <div
      className="modal-overlay flex items-center justify-center bg-foreground/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="relative w-[90vw] max-w-sm rounded-2xl bg-card shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-heading font-semibold text-sm">Escanear Código de Barras</h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner area */}
        <div className="p-4">
          {error ? (
            <div className="text-center space-y-3 py-6">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={() => setShowManual(true)} className="gap-2">
                <Keyboard className="h-4 w-4" /> Digitar manualmente
              </Button>
            </div>
          ) : (
            <>
              <div id="barcode-scanner-region" className="rounded-lg overflow-hidden bg-muted min-h-[200px]" />
              <p className="text-xs text-muted-foreground text-center mt-3">
                Aponte a câmera para o código de barras
              </p>
            </>
          )}

          {!error && !showManual && (
            <Button variant="ghost" size="sm" className="w-full mt-3 text-muted-foreground gap-2" onClick={() => setShowManual(true)}>
              <Keyboard className="h-4 w-4" /> Digitar manualmente
            </Button>
          )}

          {showManual && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Digite o código de barras"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              />
              <Button className="w-full" size="sm" onClick={handleManualSubmit} disabled={!manualCode.trim()}>
                Confirmar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
