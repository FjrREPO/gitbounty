import { CheckIcon } from "lucide-react";
import type { Bounty } from "@/lib/subgraph";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  hint: string;
}

const STEPS: Step[] = [
  { label: "Funded", hint: "Reward locked in escrow" },
  { label: "Claimed", hint: "Contributor linked a PR" },
  { label: "Merged & verified", hint: "Proven on-chain" },
  { label: "Paid", hint: "Escrow released" },
];

/**
 * Index of the step in progress. A paid bounty is past the last step, so
 * every marker reads as complete.
 */
function currentStep(bounty: Bounty): number {
  if (bounty.status === "PAID") {
    return STEPS.length;
  }
  if (bounty.status === "RECLAIMED") {
    return 0;
  }
  return bounty.claims.length > 0 ? 1 : 0;
}

/** Horizontal progress rail explaining the bounty lifecycle at a glance. */
export function BountyProgress({ bounty }: { bounty: Bounty }) {
  const active = currentStep(bounty);
  const reclaimed = bounty.status === "RECLAIMED";

  return (
    <div className="flex items-start gap-1 overflow-x-auto">
      {STEPS.map((step, index) => {
        const done = !reclaimed && index < active;
        const isCurrent = !reclaimed && index === active;
        return (
          <div key={step.label} className="flex min-w-0 flex-1 items-start gap-1">
            <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  done && "border-emerald-500/40 bg-emerald-500/15 text-emerald-500",
                  isCurrent && "border-foreground bg-foreground text-background",
                  !done && !isCurrent && "border-foreground/15 text-foreground/30",
                )}
              >
                {done ? <CheckIcon className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium leading-tight",
                  done || isCurrent ? "text-foreground" : "text-foreground/35",
                )}
              >
                {step.label}
              </span>
              <span className="text-[10px] leading-tight text-foreground/35">{step.hint}</span>
            </div>
            {index < STEPS.length - 1 ? (
              <span
                className={cn(
                  "mt-3.5 h-px min-w-4 flex-1",
                  index < active && !reclaimed ? "bg-emerald-500/40" : "bg-foreground/10",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
