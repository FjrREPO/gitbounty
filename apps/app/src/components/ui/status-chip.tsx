import type { BountyStatus } from "@/lib/subgraph";
import { cn } from "@/lib/utils";

const STYLES: Record<BountyStatus, string> = {
  OPEN: "bg-emerald-500/10 text-emerald-700 border-emerald-600/30",
  PAID: "bg-sky-500/10 text-sky-700 border-sky-600/30",
  RECLAIMED: "bg-zinc-500/10 text-zinc-700 border-zinc-600/30",
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
