import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

import { cn } from "@/lib/utils";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

/**
 * Conteúdo com altura animada nos dois sentidos (abre 220ms, fecha 180ms).
 * O Radix mede a altura real em `--radix-collapsible-content-height` e mantém
 * o nó montado até a animação de saída terminar.
 */
const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleContent
    ref={ref}
    className={cn(
      "overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up",
      className,
    )}
    {...props}
  />
));
CollapsibleContent.displayName = CollapsiblePrimitive.CollapsibleContent.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
