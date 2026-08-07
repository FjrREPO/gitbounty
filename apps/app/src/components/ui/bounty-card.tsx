"use client";

import { GitForkIcon, MessagesSquareIcon, StarIcon, UsersIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ContributorStack } from "@/components/ui/contributor-stack";
import { FlrAmount } from "@/components/ui/flr-amount";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { formatFlr, formatUsdCents, timeLeft } from "@/lib/format";
import { avatarUrl, languageColor, useIssueInfo, useRepoInfo } from "@/lib/github";
import type { Bounty } from "@/lib/subgraph";

function compact(n: number): string {
  return Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

function Reward({ bounty }: { bounty: Bounty }) {
  if (bounty.rewardUsdCents !== "0") {
    return <>{formatUsdCents(bounty.rewardUsdCents)}</>;
  }
  return <FlrAmount size="lg">{formatFlr(bounty.amount)} FLR</FlrAmount>;
}

/** Marketplace card: GitHub identity + live repo stats + on-chain reward. */
export function BountyCard({ bounty }: { bounty: Bounty }) {
  const [owner] = bounty.repo.split("/");
  const repoQuery = useRepoInfo(bounty.repo);
  const issueQuery = useIssueInfo(bounty.repo, bounty.issueNumber);
  const repo = repoQuery.data;
  const issue = issueQuery.data;
  const ghLoading = repoQuery.isLoading || issueQuery.isLoading;

  return (
    <Link
      href={`/bounties/${bounty.bountyId}`}
      className="group flex cursor-pointer flex-col rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-foreground/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src={avatarUrl(owner)}
            alt={owner}
            width={40}
            height={40}
            unoptimized
            className="size-10 shrink-0 rounded-xl border border-foreground/10 bg-foreground/5"
          />
          <div className="min-w-0">
            <div className="truncate font-mono text-sm text-foreground">{bounty.repo}</div>
            <div className="text-xs text-foreground/40">issue #{bounty.issueNumber}</div>
          </div>
        </div>
        <StatusChip status={bounty.status} />
      </div>

      {ghLoading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ) : (
        <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-foreground">
          {issue?.title ?? `Issue #${bounty.issueNumber}`}
        </h3>
      )}

      {repo?.description ? (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/50">
          {repo.description}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/50">
        {repo?.language ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: languageColor(repo.language) }}
            />
            {repo.language}
          </span>
        ) : null}
        {repo ? (
          <>
            <span className="inline-flex items-center gap-1">
              <StarIcon className="size-3.5" />
              {compact(repo.stars)}
            </span>
            <span className="inline-flex items-center gap-1">
              <GitForkIcon className="size-3.5" />
              {compact(repo.forks)}
            </span>
          </>
        ) : null}
        {issue ? (
          <span className="inline-flex items-center gap-1">
            <MessagesSquareIcon className="size-3.5" />
            {issue.comments}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-foreground/5 pt-3">
        <div>
          <div className="text-lg font-bold tracking-tight text-foreground">
            <Reward bounty={bounty} />
          </div>
          <div className="text-[11px] text-foreground/40">
            {bounty.rewardUsdCents !== "0"
              ? `escrow ${formatFlr(bounty.amount)} FLR · FTSO at payout`
              : "fixed payout"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right text-[11px] text-foreground/40">
          <ContributorStack repo={bounty.repo} max={4} />
          {bounty.status === "OPEN" ? <div>expires {timeLeft(bounty.expiresAt)}</div> : null}
          {bounty.claims.length > 0 ? (
            <div className="inline-flex items-center gap-1">
              <UsersIcon className="size-3" />
              {bounty.claims.length} claim{bounty.claims.length > 1 ? "s" : ""}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
