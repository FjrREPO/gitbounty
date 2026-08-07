"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BountyCard, BountyCardShape } from "@/components/ui/bounty-card";
import { PageShell } from "@/components/ui/page-shell";
import { Phantom } from "@/components/ui/phantom";
import { formatFlr } from "@/lib/format";
import {
  type Bounty,
  type BountyStatus,
  useInfiniteBounties,
  useProtocolStats,
} from "@/lib/subgraph";
import { cn } from "@/lib/utils";

const FILTERS: { label: string; value: BountyStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "Paid", value: "PAID" },
  { label: "Reclaimed", value: "RECLAIMED" },
];

const GRID = "grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3";

/** Debounced so typing does not fire a subgraph query per keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export function BountyBoard({ initialBounties }: { initialBounties: Bounty[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BountyStatus | "ALL">("ALL");
  const debouncedSearch = useDebounced(search, 300);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteBounties({ status: filter, search: debouncedSearch, initialBounties });
  const { data: stats } = useProtocolStats();

  const bounties = useMemo(() => data?.pages.flat() ?? [], [data]);

  // Load the next page when the sentinel comes near the viewport, so the list
  // extends before the user reaches the end rather than after.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || isFetchingNextPage) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <PageShell
      title="Bounties"
      actions={
        <div className="flex items-center gap-4">
          {stats ? (
            <div className="hidden text-right text-xs text-foreground/65 sm:block">
              <div>
                {stats.openBounties} open · {stats.totalBounties} total
              </div>
              <div>{formatFlr(stats.totalPaidWei)} FLR paid out</div>
            </div>
          ) : null}
          <Link
            href="/create"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-80"
          >
            <PlusIcon className="size-3.5" aria-hidden /> New bounty
          </Link>
        </div>
      }
      toolbar={
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/60"
              aria-hidden
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repository…"
              aria-label="Search bounties by repository"
              className="w-full rounded-full border border-foreground/15 bg-transparent py-2 pl-9 pr-4 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
            />
          </div>
          <fieldset className="flex gap-1 border-0 p-0">
            <legend className="sr-only">Filter by status</legend>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={cn(
                  "cursor-pointer rounded-full px-3.5 py-1.5 text-xs transition-colors",
                  filter === f.value
                    ? "bg-foreground font-semibold text-background"
                    : "text-foreground/65 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </fieldset>
        </div>
      }
    >
      {isLoading ? (
        <div className={GRID}>
          {Array.from({ length: 6 }, (_, i) => `skeleton-${i}`).map((key) => (
            <Phantom key={key} loading>
              <BountyCardShape />
            </Phantom>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-foreground/65">
          Failed to load bounties from the indexer. Retrying…
        </div>
      ) : bounties.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-16 text-center">
          <p className="text-sm text-foreground/65">
            {search || filter !== "ALL"
              ? "No bounties match your filter."
              : "No bounties yet. Fund a GitHub issue to create the first one."}
          </p>
          <Link
            href="/create"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-80"
          >
            <PlusIcon className="size-3.5" aria-hidden /> Create a bounty
          </Link>
        </div>
      ) : (
        <>
          <ul className={cn(GRID, "list-none")}>
            {bounties.map((bounty, index) => (
              <li key={bounty.bountyId} className="flex">
                {/* The first row is above the fold on every breakpoint. */}
                <BountyCard bounty={bounty} priority={index < 3} />
              </li>
            ))}
          </ul>

          {/* Sits below the last row; crossing it pulls the next page in. */}
          <div ref={sentinel} aria-hidden className="h-px" />

          {isFetchingNextPage ? (
            <div className={cn(GRID, "pt-0")}>
              {Array.from({ length: 3 }, (_, i) => `more-${i}`).map((key) => (
                <Phantom key={key} loading>
                  <BountyCardShape />
                </Phantom>
              ))}
            </div>
          ) : null}

          <p aria-live="polite" className="pb-8 text-center text-xs text-foreground/65">
            {hasNextPage
              ? isFetchingNextPage
                ? "Loading more…"
                : ""
              : `${bounties.length} bounties`}
          </p>
        </>
      )}
    </PageShell>
  );
}
