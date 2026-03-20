import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Settings, Target } from 'lucide-react';

const navItems = [
  { to: '/', icon: BookOpen, label: 'Diário' },
  { to: '/metas', icon: Target, label: 'Metas' },
  { to: '/configuracoes', icon: Settings, label: 'Config.' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-body transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
              <span className={active ? 'font-semibold' : ''}>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
