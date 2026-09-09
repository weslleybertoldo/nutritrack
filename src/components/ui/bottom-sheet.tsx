import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * BottomSheet — folha inferior animada (padrão Skill-wbs-navegacao / MyFinances).
 *
 * Radix Dialog controlado por `open`/`onOpenChange`: o nó fica montado até a
 * animação de SAÍDA terminar (Presence), então fecha deslizando em vez de sumir
 * "seco". Entra em 300ms ease-out, sai em 200ms ease-in; overlay esmaece 200ms.
 *
 * z-index acima do BottomNav (z-[100]) e do UpdateChecker (z-[110]).
 */

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Descrição acessível (sr-only). Sem ela o Radix avisa no console. */
  description?: string;
  children: React.ReactNode;
  /** Faixa fixa entre o cabeçalho e o corpo (ex.: abas). Não rola. */
  subheader?: React.ReactNode;
  /** Rodapé fixo (botões). Fica fora da área que rola. */
  footer?: React.ReactNode;
  /** Conteúdo extra à direita do título (antes do X). */
  headerExtra?: React.ReactNode;
  /** Classe do painel (ex.: `max-h-[90vh]`). */
  className?: string;
  /** Classe da área rolável. */
  bodyClassName?: string;
  /** Impede fechar tocando fora/ESC (ex.: enquanto salva). */
  dismissible?: boolean;
}

const BottomSheet = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  subheader,
  footer,
  headerExtra,
  className,
  bodyClassName,
  dismissible = true,
}: BottomSheetProps) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
      />
      <DialogPrimitive.Content
        // Sem descrição, remove o aria-describedby (senão o Radix avisa no console).
        {...(description ? {} : { "aria-describedby": undefined })}
        onOpenAutoFocus={(e) => {
          // Sem foco automático: no celular o teclado subindo no meio da animação dá "pulo".
          e.preventDefault();
        }}
        onPointerDownOutside={(e) => { if (!dismissible) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!dismissible) e.preventDefault(); }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[201] mx-auto flex w-full max-w-lg flex-col rounded-t-2xl border-t border-border bg-card text-foreground shadow-2xl outline-none",
          "max-h-[85vh]",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300 data-[state=open]:ease-out",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200 data-[state=closed]:ease-in",
          className,
        )}
      >
        {/* Alça */}
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

        {/* Cabeçalho */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <DialogPrimitive.Title className="font-heading font-semibold">{title}</DialogPrimitive.Title>
          <div className="flex items-center gap-1">
            {headerExtra}
            <DialogPrimitive.Close
              className="pressable-sm -mr-1 p-1 text-foreground/80 hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
        </div>
        {description && (
          <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
        )}

        {subheader && <div className="shrink-0">{subheader}</div>}

        {/* Corpo rolável */}
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", bodyClassName)}>{children}</div>

        {/* Rodapé fixo */}
        {footer}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);
BottomSheet.displayName = "BottomSheet";

const BottomSheetClose = DialogPrimitive.Close;

export { BottomSheet, BottomSheetClose };
export type { BottomSheetProps };
