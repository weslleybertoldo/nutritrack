import { useCallback, useEffect, useState } from "react";

/** Duração máxima da animação de saída dos modais (BottomSheet 200ms + folga). */
export const EXIT_ANIMATION_MS = 260;

/**
 * Mantém `mounted=true` por `delayMs` depois de `open` virar false — tempo da
 * animação de saída rodar antes de desmontar o componente. Assim o modal nasce
 * com estado zerado a cada abertura (monta de novo) e ainda fecha deslizando.
 */
export function useDelayedUnmount(open: boolean, delayMs: number = EXIT_ANIMATION_MS): boolean {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), delayMs);
    return () => clearTimeout(t);
  }, [open, delayMs]);
  return mounted || open;
}

/**
 * Estado de um modal/sheet que carrega um dado (ex.: item sendo editado).
 * `data` é retido depois de fechar, para o conteúdo continuar renderizado
 * durante a animação de saída.
 */
export function useSheet<T>() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const mounted = useDelayedUnmount(open);
  const show = useCallback((d: T) => {
    setData(d);
    setOpen(true);
  }, []);
  const hide = useCallback(() => setOpen(false), []);
  const onOpenChange = useCallback((o: boolean) => {
    if (!o) setOpen(false);
  }, []);
  return { open, data, mounted, show, hide, onOpenChange, setData };
}

/** Versão booleana (modal sem dado). */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const mounted = useDelayedUnmount(open);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const onOpenChange = useCallback((o: boolean) => setOpen(o), []);
  return { open, mounted, show, hide, toggle, onOpenChange };
}
