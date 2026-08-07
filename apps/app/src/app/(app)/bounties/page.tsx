"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BountyCard } from "@/components/ui/bounty-card";
import { PageShell } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFlr } from "@/lib/format";
import { type BountyStatus, useBounties } from "@/lib/subgraph";
import { cn } from "@/lib/utils";

const FILTERS: { label: string; value: BountyStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "Paid", value: "PAID" },
  { label: "Reclaimed", value: "RECLAIMED" },
];

export default function BountiesPage() {
  const { data, isLoading, error } = useBounties();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BountyStatus | "ALL">("ALL");

  const bounties = useMemo(() => {
    let list = data?.bounties ?? [];
    if (filter !== "ALL") {
      list = list.filter((b) => b.status === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((b) => b.repo.toLowerCase().includes(q));
    }
    return list;
  }, [data, filter, search]);

  return (
    <PageShell
      title="Bounties"
      actions={
        <div className="flex items-center gap-4">
          {data?.protocolStats ? (
            <div className="hidden text-right text-xs text-foreground/50 sm:block">
              <div>
                {data.protocolStats.openBounties} open · {data.protocolStats.totalBounties} total
              </div>
              <div>{formatFlr(data.protocolStats.totalPaidWei)} FLR paid out</div>
            </div>
          ) : null}
          <Link
            href="/create"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-80"
          >
            <PlusIcon className="size-3.5" /> New bounty
          </Link>
        </div>
      }
      toolbar={
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repository…"
              className="w-full rounded-full border border-foreground/10 bg-transparent py-2 pl-9 pr-4 text-sm text-foreground outline-none transition-colors focus:border-foreground/30"
            />
          </div>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "cursor-pointer rounded-full px-3.5 py-1.5 text-xs transition-colors",
                  filter === f.value
                    ? "bg-foreground font-semibold text-background"
                    : "text-foreground/50 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => `card-${i}`).map((key) => (
            <Skeleton key={key} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-foreground/50">
          Failed to load bounties from the indexer. Retrying…
        </div>
      ) : bounties.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-16 text-center">
          <p className="text-sm text-foreground/50">
            {search || filter !== "ALL"
              ? "No bounties match your filter."
              : "No bounties yet. Fund a GitHub issue to create the first one."}
          </p>
          <Link
            href="/create"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-80"
          >
            <PlusIcon className="size-3.5" /> Create a bounty
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {bounties.map((bounty) => (
            <BountyCard key={bounty.bountyId} bounty={bounty} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
