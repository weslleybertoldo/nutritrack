import { useEffect, useRef } from "react";

/**
 * Pré-carrega rotas `lazy()` depois do 1º render, em idle: a troca de aba
 * nunca espera chunk (Skill-wbs-navegacao §1.4). Recebe as mesmas fábricas
 * usadas no `lazy(() => import('./pages/X'))`.
 */
export function usePreloadRoutes(loaders: Array<() => Promise<unknown>>) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const run = () => {
      loaders.forEach((load) => {
        load().catch(() => {
          /* offline: o chunk é buscado na navegação */
        });
      });
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
