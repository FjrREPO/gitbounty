"use client";

import { GitForkIcon, MessagesSquareIcon, StarIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { BlurImage } from "@/components/ui/blur-image";
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

const CARD =
  "group flex h-full w-full cursor-pointer flex-col rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-foreground/[0.04]";

/**
 * The card's skeleton. Real markup rather than a stack of grey bars, because
 * Phantom derives the shimmer from whatever boxes it measures here — so the
 * placeholder stays in step with the card by construction.
 */
export function BountyCardShape() {
  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-10 shrink-0 rounded-xl bg-foreground/5" />
          <div className="min-w-0 space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-foreground/5" />
            <div className="h-2.5 w-16 rounded bg-foreground/5" />
          </div>
        </div>
        <div className="h-5 w-14 rounded-full bg-foreground/5" />
      </div>
      <div className="mt-3 h-10 w-full rounded bg-foreground/5" />
      <div className="mt-3 h-3 w-40 rounded bg-foreground/5" />
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-foreground/5 pt-3">
        <div className="space-y-1.5">
          <div className="h-6 w-24 rounded bg-foreground/5" />
          <div className="h-2.5 w-28 rounded bg-foreground/5" />
        </div>
        <div className="h-7 w-20 rounded-full bg-foreground/5" />
      </div>
    </div>
  );
}

/** Marketplace card: GitHub identity + live repo stats + on-chain reward. */
export function BountyCard({ bounty, priority }: { bounty: Bounty; priority?: boolean }) {
  const [owner, name] = bounty.repo.split("/");
  const repoQuery = useRepoInfo(bounty.repo);
  const issueQuery = useIssueInfo(bounty.repo, bounty.issueNumber);
  const repo = repoQuery.data;
  const issue = issueQuery.data;
  const ghLoading = repoQuery.isLoading || issueQuery.isLoading;
  const isUsd = bounty.rewardUsdCents !== "0";

  return (
    <Link href={`/bounties/${bounty.bountyId}`} className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BlurImage
            src={avatarUrl(owner)}
            alt=""
            width={40}
            height={40}
            sizes="40px"
            // Avatars are the largest thing painted above the fold, and the
            // default lazy load holds them until after layout.
            priority={priority}
            className="size-10 shrink-0 rounded-xl border border-foreground/10 bg-foreground/5"
          />
          <div className="min-w-0">
            {/* Owner and name on separate lines: side by side, the name had
                about 150px and was cut mid-word on every card. */}
            <div className="truncate font-mono text-[11px] leading-tight text-foreground/65">
              {owner}
            </div>
            <div className="truncate font-mono text-sm leading-tight text-foreground">{name}</div>
            <div className="text-[11px] text-foreground/65">issue #{bounty.issueNumber}</div>
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
        <h2 className="mt-3 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-foreground">
          {issue?.title ?? `Issue #${bounty.issueNumber}`}
        </h2>
      )}

      {repo?.description ? (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/65">
          {repo.description}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/65">
        {repo?.language ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: languageColor(repo.language) }}
              aria-hidden
            />
            {repo.language}
          </span>
        ) : null}
        {repo ? (
          <>
            <span className="inline-flex items-center gap-1" title="Stars">
              <StarIcon className="size-3.5" aria-hidden />
              {compact(repo.stars)}
            </span>
            <span className="inline-flex items-center gap-1" title="Forks">
              <GitForkIcon className="size-3.5" aria-hidden />
              {compact(repo.forks)}
            </span>
          </>
        ) : null}
        {issue ? (
          <span className="inline-flex items-center gap-1" title="Comments">
            <MessagesSquareIcon className="size-3.5" aria-hidden />
            {issue.comments}
          </span>
        ) : null}
      </div>

      {/* mt-auto pins the footer to the bottom, so reward figures line up across
          the row no matter how tall each issue title turns out to be. */}
      <div className="mt-auto pt-4">
        <div className="flex items-end justify-between gap-3 border-t border-foreground/5 pt-3">
          <div className="min-w-0">
            <div className="text-lg font-bold tracking-tight text-foreground">
              <Reward bounty={bounty} />
            </div>
            <div className="truncate text-[11px] text-foreground/65">
              {isUsd ? `${formatFlr(bounty.amount)} FLR escrowed · FTSO at payout` : "fixed payout"}
            </div>
          </div>
          <div className="shrink-0">
            <ContributorStack repo={bounty.repo} max={4} />
          </div>
        </div>
        {/* Its own row, so a long escrow line can never push it out of alignment. */}
        <div className="mt-2 flex h-4 items-center justify-end gap-2 text-[11px] text-foreground/65">
          <span className="flex shrink-0 items-center gap-2">
            {bounty.claims.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                <UsersIcon className="size-3" aria-hidden />
                {bounty.claims.length} claim{bounty.claims.length > 1 ? "s" : ""}
              </span>
            ) : null}
            {bounty.status === "OPEN" ? <span>expires {timeLeft(bounty.expiresAt)}</span> : null}
          </span>
        </div>
      </div>
    </Link>
  );
}
