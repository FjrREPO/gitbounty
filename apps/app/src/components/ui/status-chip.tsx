import { type DisplayStatus, STATUS_LABEL } from "@/lib/bounty-state";
import { cn } from "@/lib/utils";

const STYLES: Record<DisplayStatus, string> = {
  OPEN: "bg-emerald-500/10 text-emerald-700 border-emerald-600/30",
  // Amber, not red: the bounty is fine, it just cannot be started fresh.
  STALE: "bg-amber-500/10 text-amber-700 border-amber-600/30",
  EXPIRED: "bg-orange-500/10 text-orange-800 border-orange-700/30",
  PAID: "bg-sky-500/10 text-sky-700 border-sky-600/30",
  RECLAIMED: "bg-zinc-500/10 text-zinc-700 border-zinc-600/30",
};

export function StatusChip({ status }: { status: DisplayStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        STYLES[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
