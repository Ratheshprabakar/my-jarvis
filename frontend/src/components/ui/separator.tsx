/**
 * Radix Separator — semantic <hr>-equivalent with proper role="separator".
 */
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { clsx } from "clsx";

interface Props {
  orientation?: "horizontal" | "vertical";
  className?: string;
  decorative?: boolean;
}

export function Separator({
  orientation = "horizontal",
  decorative = true,
  className,
}: Props) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={clsx(
        "shrink-0 bg-surface-3/80",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}
