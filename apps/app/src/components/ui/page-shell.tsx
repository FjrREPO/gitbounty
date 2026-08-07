import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page frame: a fixed title, a fixed toolbar (optional), and a bordered container whose
 * body is the only thing that scrolls — the title, toolbar and the container's edges stay put.
 * Fills the viewport height left by the header (see the earn layout's `h-dvh` main).
 */
export function PageShell({
  title,
  actions,
  toolbar,
  children,
  className,
}: {
  title: ReactNode;
  /** Right-aligned content next to the title (e.g. a total, a toggle). */
  actions?: ReactNode;
  /** Fixed bar at the top of the scroll container (search / filters / sort). */
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex h-full w-full max-w-5xl flex-col px-4 pt-6 pb-4 sm:px-6 sm:pt-8 sm:pb-6",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-foreground/10">
        {toolbar ? <div className="shrink-0 border-b border-foreground/5">{toolbar}</div> : null}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
