/**
 * Radix Toast — queued, animated, dismissible notifications.
 *
 * Usage:
 *   1. Wrap app with <ToastProvider> and render <ToastViewport /> inside it.
 *   2. Call addToast() from useToast() anywhere in the tree.
 */
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X, CheckCircle2, AlertCircle, Info, CalendarPlus } from "lucide-react";
import { clsx } from "clsx";
import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode,
} from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type ToastVariant = "default" | "success" | "warning" | "error" | "calendar";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastCtx {
  addToast: (item: Omit<ToastItem, "id">) => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastCtx>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// ── Variant config ─────────────────────────────────────────────────────────

const VARIANT_CFG: Record<ToastVariant, {
  icon: ReactNode;
  bar: string;
}> = {
  default:  { icon: <Info           className="w-3.5 h-3.5" aria-hidden="true" />, bar: "bg-fg-subtle"    },
  success:  { icon: <CheckCircle2   className="w-3.5 h-3.5" aria-hidden="true" />, bar: "bg-emerald-500"  },
  warning:  { icon: <AlertCircle    className="w-3.5 h-3.5" aria-hidden="true" />, bar: "bg-amber-500"    },
  error:    { icon: <AlertCircle    className="w-3.5 h-3.5" aria-hidden="true" />, bar: "bg-red-500"      },
  calendar: { icon: <CalendarPlus   className="w-3.5 h-3.5" aria-hidden="true" />, bar: "bg-emerald-500"  },
};

const VARIANT_ICON_COLOR: Record<ToastVariant, string> = {
  default:  "text-fg-muted",
  success:  "text-emerald-500",
  warning:  "text-amber-500",
  error:    "text-red-500",
  calendar: "text-emerald-500",
};

// ── Single Toast ───────────────────────────────────────────────────────────

function ToastEl({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const v   = item.variant ?? "default";
  const cfg = VARIANT_CFG[v];
  const [open, setOpen] = useState(true);
  const removed = useRef(false);

  const remove = useCallback(() => {
    if (removed.current) return;
    removed.current = true;
    // Keep mounted briefly so the close animation can play
    window.setTimeout(() => onDismiss(item.id), 160);
  }, [item.id, onDismiss]);

  useEffect(() => () => { removed.current = true; }, []);

  return (
    <ToastPrimitive.Root
      open={open}
      duration={3500}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) remove();
      }}
      className={clsx(
        "relative overflow-hidden flex items-start gap-3 pointer-events-auto",
        "w-80 rounded-xl bg-surface-1 border border-surface-3/70 shadow-2xl p-3.5",
        "motion-safe:data-[state=open]:animate-[toastSlideIn_200ms_ease-out]",
        "motion-safe:data-[state=closed]:animate-[toastHide_150ms_ease-in]",
        "motion-safe:data-[swipe=end]:animate-[toastSwipeOut_100ms_ease-out]",
        "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
      )}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${cfg.bar}`} aria-hidden="true" />

      <span className={clsx("shrink-0 mt-0.5 ml-1", VARIANT_ICON_COLOR[v])}>
        {cfg.icon}
      </span>

      <div className="flex-1 min-w-0">
        <ToastPrimitive.Title className="text-xs font-semibold text-fg leading-snug">
          {item.title}
        </ToastPrimitive.Title>
        {item.description && (
          <ToastPrimitive.Description className="text-[11px] text-fg-muted mt-0.5 leading-relaxed line-clamp-2">
            {item.description}
          </ToastPrimitive.Description>
        )}
      </div>

      <ToastPrimitive.Close
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(false);
          remove();
        }}
        className={clsx(
          "touch-manip shrink-0 -mr-1 -mt-1 p-1.5 rounded text-fg-subtle hover:text-fg",
          "hover:bg-surface-2 transition-colors duration-100 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-surface-3",
        )}
      >
        <X className="w-3.5 h-3.5 pointer-events-none" aria-hidden="true" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

// ── Provider + Viewport ────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const uid = useId();

  const addToast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = `${uid}-${Date.now()}`;
    setToasts((prev) => [...prev.slice(-4), { ...item, id }]);
  }, [uid]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={3500}>
        {children}

        {toasts.map((t) => (
          <ToastEl key={t.id} item={t} onDismiss={dismiss} />
        ))}

        {/* Viewport: bottom-right corner */}
        <ToastPrimitive.Viewport
          className={clsx(
            "fixed bottom-5 right-5 z-[100]",
            "flex flex-col gap-2 w-80 max-w-[100vw]",
            "outline-none pointer-events-none",
            "[&>*]:pointer-events-auto",
          )}
          aria-label="Notifications"
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
