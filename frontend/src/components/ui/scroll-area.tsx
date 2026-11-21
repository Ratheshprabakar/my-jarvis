/**
 * Radix ScrollArea — consistent custom scrollbar across all browsers.
 */
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { clsx } from "clsx";

interface Props {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

export function ScrollArea({ children, className, maxHeight }: Props) {
  return (
    <ScrollAreaPrimitive.Root
      className={clsx("overflow-hidden", className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <ScrollAreaPrimitive.Viewport className="h-full max-h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>

      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="flex select-none touch-none p-px w-1.5 transition-opacity duration-150 hover:opacity-100 opacity-70"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-surface-3 before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:min-w-[44px] before:h-full before:min-h-[44px]" />
      </ScrollAreaPrimitive.Scrollbar>

      <ScrollAreaPrimitive.Scrollbar
        orientation="horizontal"
        className="flex select-none touch-none p-px h-1.5 opacity-0"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-surface-3" />
      </ScrollAreaPrimitive.Scrollbar>

      <ScrollAreaPrimitive.Corner className="bg-surface-2" />
    </ScrollAreaPrimitive.Root>
  );
}
