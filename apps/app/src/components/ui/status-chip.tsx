import type { BountyStatus } from "@/lib/subgraph";
import { cn } from "@/lib/utils";

const STYLES: Record<BountyStatus, string> = {
  OPEN: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  PAID: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  RECLAIMED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

export function StatusChip({ status }: { status: BountyStatus }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        STYLES[status],
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}
