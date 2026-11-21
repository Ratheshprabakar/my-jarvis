/**
 * Radix Collapsible — animated expand/collapse with correct ARIA.
 */
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";

interface Props {
  triggerLabel: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function Collapsible({ triggerLabel, children, defaultOpen = false, className }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <CollapsiblePrimitive.Root
      open={open}
      onOpenChange={setOpen}
      className={clsx("w-full", className)}
    >
      <CollapsiblePrimitive.Trigger
        className={clsx(
          "flex items-center gap-1.5 w-full px-3 py-2 text-[11px] text-fg-muted",
          "hover:text-fg transition-colors duration-100 select-none",
          "focus-visible:outline-none focus-visible:text-fg",
        )}
        aria-label={`${open ? "Collapse" : "Expand"} ${triggerLabel}`}
      >
        <ChevronRight
          className={clsx(
            "w-3 h-3 shrink-0 transition-transform duration-150",
            open && "rotate-90",
          )}
          aria-hidden="true"
        />
        {triggerLabel}
      </CollapsiblePrimitive.Trigger>

      <CollapsiblePrimitive.Content
        className={clsx(
          "overflow-hidden",
          "motion-safe:data-[state=open]:animate-[collapsibleOpen_150ms_ease-out]",
          "motion-safe:data-[state=closed]:animate-[collapsibleClose_120ms_ease-in]",
        )}
      >
        {children}
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
}
