/**
 * Radix Switch — theme / boolean toggles.
 */
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { clsx } from "clsx";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { forwardRef } from "react";

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={clsx(
        "touch-manip peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full",
        "border border-surface-3/70 bg-surface-2 transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        "data-[state=checked]:bg-accent data-[state=checked]:border-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={clsx(
          "pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm",
          "ring-0 transition-transform duration-150",
          "data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[3px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
});
