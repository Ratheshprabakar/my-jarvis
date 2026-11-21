/**
 * Radix Avatar — image with accessible fallback initials.
 */
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { clsx } from "clsx";

interface Props {
  name: string;
  src?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const SIZE: Record<"xs" | "sm" | "md", string> = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
};

function nameHue(name: string): number {
  return [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase();
}

export function Avatar({ name, src, size = "sm", className }: Props) {
  const hue = nameHue(name);
  return (
    <AvatarPrimitive.Root
      title={name}
      aria-label={name}
      className={clsx(
        "relative shrink-0 overflow-hidden rounded-full font-semibold text-white select-none",
        "flex items-center justify-center",
        SIZE[size],
        className,
      )}
      style={{
        backgroundColor: `hsl(${hue}, var(--avatar-sat), var(--avatar-lit))`,
      }}
    >
      {src && (
        <AvatarPrimitive.Image
          src={src}
          alt={name}
          className="aspect-square h-full w-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback
        delayMs={src ? 300 : 0}
        className="flex h-full w-full items-center justify-center"
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const visible = names.slice(0, max);
  const extra   = names.length - max;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((name) => (
        <Avatar
          key={name}
          name={name}
          size="xs"
          className="ring-1 ring-surface-1"
        />
      ))}
      {extra > 0 && (
        <span
          aria-label={`${extra} more attendees`}
          className="w-5 h-5 rounded-full bg-surface-2 border border-surface-3 text-[9px] text-fg-muted font-medium flex items-center justify-center ring-1 ring-surface-1"
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
