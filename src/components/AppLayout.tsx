import React, { ReactNode } from 'react';
import BottomNav from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  headerRight?: ReactNode;
}

export default function AppLayout({ children, title, headerRight }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {title && (
        <header className="sticky top-0 z-40 border-b border-muted-foreground/30 bg-background/95 backdrop-blur-md">
          <div className="mx-auto max-w-lg px-4 pt-3 pb-2.5 flex items-end justify-between">
            <div>
              <p className="font-heading text-[10px] tracking-[0.2em] text-muted-foreground uppercase leading-none">
                Nutri<span className="text-primary">Track</span>
              </p>
              <h1 className="text-xl text-foreground leading-tight mt-1">{title}</h1>
            </div>
            {headerRight && <div className="pb-0.5">{headerRight}</div>}
          </div>
        </header>
      )}
      <main className="mx-auto max-w-lg px-4 pb-safe pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
