"use client";

import { BlurImage } from "@/components/ui/blur-image";
import { type Contributor, useContributors } from "@/lib/github";
import { cn } from "@/lib/utils";

function compact(n: number): string {
  return Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

function Avatar({
  contributor,
  size,
  index,
}: {
  contributor: Contributor;
  size: "sm" | "lg";
  index: number;
}) {
  const px = size === "lg" ? 56 : 28;
  return (
    <a
      href={`https://github.com/${contributor.login}`}
      target="_blank"
      rel="noreferrer"
      className="group relative -ml-2.5 first:ml-0 transition-transform duration-150 hover:z-20 hover:-translate-y-1 hover:scale-110"
      style={{ zIndex: 10 - index }}
    >
      <BlurImage
        src={contributor.avatarUrl}
        alt={`@${contributor.login}`}
        width={px}
        height={px}
        sizes={`${px}px`}
        className={cn(
          "rounded-full border-2 border-background ring-1 ring-foreground/20 bg-foreground/5",
          size === "lg" ? "size-14" : "size-7",
        )}
      />
      {/* Hover tooltip card, like a contributor spotlight. */}
      <span className="pointer-events-none absolute -top-14 left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-foreground/15 bg-background px-3.5 py-2 text-center shadow-xl shadow-black/40 group-hover:block">
        <span className="block text-xs font-bold text-foreground">@{contributor.login}</span>
        <span className="block text-[10px] text-foreground/65">
          {compact(contributor.contributions)} contributions
        </span>
      </span>
    </a>
  );
}

/**
 * Overlapping avatar stack of the repo's top contributors with a hover
 * spotlight tooltip. `size="lg"` is the detail-page variant.
 */
export function ContributorStack({
  repo,
  size = "sm",
  max = 6,
}: {
  repo: string;
  size?: "sm" | "lg";
  max?: number;
}) {
  const { data: contributors } = useContributors(repo);
  if (!contributors || contributors.length === 0) {
    return null;
  }

  const shown = contributors.slice(0, max);
  const extra = contributors.length - shown.length;

  return (
    <div className="flex items-center">
      {shown.map((contributor, index) => (
        <Avatar key={contributor.login} contributor={contributor} size={size} index={index} />
      ))}
      {extra > 0 ? (
        <span
          className={cn(
            "-ml-2.5 z-0 flex items-center justify-center rounded-full border-2 border-background bg-foreground/10 font-semibold text-foreground/60 ring-1 ring-foreground/20",
            size === "lg" ? "size-14 text-sm" : "size-7 text-[9px]",
          )}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
