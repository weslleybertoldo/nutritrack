import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: number;
  label?: string;
}

/**
 * Círculo de carregando (verde = `text-primary`) — usar em TODA espera que o
 * usuário precisa aguardar (Skill-wbs-navegacao §1.8). Dentro do botão, inline
 * no item ou no cabeçalho; nunca no lugar da tela inteira.
 */
export function Spinner({ className, size = 16, label = "Carregando" }: SpinnerProps) {
  return (
    <Loader2
      size={size}
      aria-label={label}
      role="status"
      className={cn("shrink-0 animate-spin text-primary", className)}
    />
  );
}
