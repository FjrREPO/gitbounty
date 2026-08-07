import type { ReactNode } from "react";

/** Label/value row used inside detail panels. */
export function DetailRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-xs text-foreground/65">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}
