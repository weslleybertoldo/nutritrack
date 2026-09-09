import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Settings, Target } from 'lucide-react';

const navItems = [
  { to: '/', icon: BookOpen, label: 'Diário' },
  { to: '/metas', icon: Target, label: 'Metas' },
  { to: '/configuracoes', icon: Settings, label: 'Config.' },
];

/**
 * Barra inferior persistente (renderizada pelo AppShell, fora do Suspense).
 * O indicador da aba ativa DESLIZA até a aba tocada (300ms) em vez de trocar
 * de lugar "seco"; cada aba responde ao toque (`pressable`).
 */
export default function BottomNav() {
  const { pathname } = useLocation();
  const activeIndex = navItems.findIndex(item => item.to === pathname);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100] border-t border-muted-foreground/30 bg-background/95 backdrop-blur-md"
      aria-label="Navegação principal"
    >
      <div className="relative mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom,0px)]">
        {/* Indicador deslizante */}
        <span
          aria-hidden
          className={`absolute -top-px left-0 h-0.5 bg-primary transition-[transform,opacity] duration-300 ease-out ${
            activeIndex < 0 ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            width: `${100 / navItems.length}%`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
          }}
        />
        {navItems.map(({ to, icon: Icon, label }, i) => {
          const active = i === activeIndex;
          return (
            <NavLink
              key={to}
              to={to}
              end
              aria-current={active ? 'page' : undefined}
              className={`pressable flex flex-1 flex-col items-center gap-1 px-3 pt-2.5 pb-2 font-heading text-[10px] uppercase tracking-widest ${
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-transform duration-200 ease-out ${active ? 'scale-110' : 'scale-100'}`}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
