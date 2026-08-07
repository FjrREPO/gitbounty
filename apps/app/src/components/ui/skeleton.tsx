import { cn } from "@/lib/utils";

/**
 * Shimmering placeholder block. Theme-aware (`bg-foreground/10` reads in light + dark) and shaped
 * entirely via `className` — height/width/rounding/circle are set by the caller so a skeleton can
 * mirror the exact box it stands in for. Reused by every route's `loading.tsx`.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded bg-foreground/10", className)} />;
}
