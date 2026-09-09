import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

/**
 * Fallback do Suspense das abas: mesmo esqueleto do AppLayout (cabeçalho +
 * blocos) com o círculo verde no lugar do título. O BottomNav fica fora do
 * Suspense, então continua na tela — nada de spinner de tela cheia.
 */
export default function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background fade-enter" aria-busy="true" aria-live="polite">
      <header className="sticky top-0 z-40 border-b border-muted-foreground/30 bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 pt-3 pb-2.5 flex items-end justify-between">
          <div>
            <p className="font-heading text-[10px] tracking-[0.2em] text-muted-foreground uppercase leading-none">
              Nutri<span className="text-primary">Track</span>
            </p>
            <Skeleton className="mt-1.5 h-6 w-40 rounded-none" />
          </div>
          <Spinner size={18} className="mb-1" label="Carregando página" />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pb-safe pt-4 space-y-3">
        <Skeleton className="h-12 w-full rounded-none" />
        <Skeleton className="h-16 w-full rounded-none" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 rounded-none" />
          <Skeleton className="h-16 rounded-none" />
          <Skeleton className="h-16 rounded-none" />
        </div>
        <Skeleton className="h-14 w-full rounded-none" />
        <Skeleton className="h-14 w-full rounded-none" />
        <Skeleton className="h-14 w-full rounded-none" />
      </main>
    </div>
  );
}
