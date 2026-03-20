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
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto max-w-lg px-4 py-3 flex items-center justify-between">
            <h1 className="font-heading text-lg font-bold tracking-tight">{title}</h1>
            {headerRight}
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
