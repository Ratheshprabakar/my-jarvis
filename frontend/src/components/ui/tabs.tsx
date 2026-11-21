/**
 * Radix Tabs — accessible tab list + panels.
 */
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { clsx } from "clsx";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { forwardRef } from "react";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={clsx(
        "inline-flex items-center gap-1 p-0.5 rounded-xl",
        "bg-surface-2 border border-surface-3/70",
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={clsx(
        "touch-manip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
        "text-fg-muted transition-[background-color,color,box-shadow] duration-150",
        "hover:text-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        "data-[state=active]:bg-surface-1 data-[state=active]:text-fg data-[state=active]:shadow-sm",
        "data-[state=active]:border-surface-3/80",
        "border border-transparent",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={clsx(
        "outline-none focus-visible:ring-2 focus-visible:ring-accent/30 rounded-xl",
        "data-[state=inactive]:hidden",
        className,
      )}
      {...props}
    />
  );
});
