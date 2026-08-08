"use client";

import {
  AlertTriangleIcon,
  ChevronDownIcon,
  CircleDotIcon,
  ExternalLinkIcon,
  GitCommitVerticalIcon,
  GitForkIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  MessagesSquareIcon,
  StarIcon,
} from "lucide-react";
import { use, useState } from "react";
import { keccak256, toHex } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { BlurImage } from "@/components/ui/blur-image";
import { BountyProgress } from "@/components/ui/bounty-progress";
import { ContributorStack } from "@/components/ui/contributor-stack";
import { DetailRow } from "@/components/ui/detail-row";
import { FlrAmount } from "@/components/ui/flr-amount";
import { Modal } from "@/components/ui/modal";
import { PageShell } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { ESCROW_ABI, ESCROW_ADDRESS, EXPLORER_URL } from "@/config/gitbounty";
import { canReclaim, displayStatus } from "@/lib/bounty-state";
import { formatFlr, formatUsdCents, shorten, timeLeft } from "@/lib/format";
import {
  avatarUrl,
  languageColor,
  useContributors,
  useIssueInfo,
  usePullInfo,
  useRepoActivity,
  useRepoInfo,
} from "@/lib/github";
import { type Bounty, type Claim, useBounty } from "@/lib/subgraph";

function compact(n: number): string {
  return Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

function RegisterClaimModal({ bountyId, onClose }: { bountyId: string; onClose: () => void }) {
  const [prNumber, setPrNumber] = useState("");
  const [githubLogin, setGithubLogin] = useState("");
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "registerClaim",
        args: [BigInt(bountyId), BigInt(prNumber), keccak256(toHex(githubLogin))],
      });
      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message.split("\n")[0] : String(err));
    }
  }

  return (
    <Modal onClose={onClose} title="Register claim">
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-foreground/60">
          Link your wallet to your GitHub login and the PR that fixes this issue. After the PR is
          merged, an FDC attestation proves the merge and the escrow pays this wallet.
        </p>
        <label className="block">
          <span className="text-xs text-foreground/65">PR number</span>
          <input
            value={prNumber}
            onChange={(e) => setPrNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="7"
            className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40"
          />
        </label>
        <label className="block">
          <span className="text-xs text-foreground/65">GitHub username</span>
          <input
            value={githubLogin}
            onChange={(e) => setGithubLogin(e.target.value.trim())}
            placeholder="octocat"
            className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40"
          />
        </label>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        {txHash ? (
          <a
            href={`${EXPLORER_URL}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="block text-xs text-emerald-400 underline"
          >
            Claim registered — view transaction
          </a>
        ) : (
          <button
            type="button"
            disabled={isPending || !prNumber || !githubLogin}
            onClick={submit}
            className="w-full cursor-pointer rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Confirm in wallet…" : "Register claim"}
          </button>
        )}
      </div>
    </Modal>
  );
}

function RepoHero({ bounty }: { bounty: Bounty }) {
  const [owner] = bounty.repo.split("/");
  const repoQuery = useRepoInfo(bounty.repo);
  const repo = repoQuery.data;
  const { data: issue } = useIssueInfo(bounty.repo, bounty.issueNumber);
  const { data: activity } = useRepoActivity(bounty.repo);
  const issueUrl = `https://github.com/${bounty.repo}/issues/${bounty.issueNumber}`;

  return (
    <div className="border-b border-foreground/10 p-6">
      <div className="flex items-start gap-4">
        <BlurImage
          src={avatarUrl(owner, 128)}
          alt=""
          width={56}
          height={56}
          sizes="56px"
          className="size-14 shrink-0 rounded-2xl border border-foreground/10 bg-foreground/5"
        />
        <div className="min-w-0 flex-1">
          <a
            href={`https://github.com/${bounty.repo}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm text-foreground/60 hover:text-foreground"
          >
            {bounty.repo}
          </a>
          <h2 className="mt-0.5 text-lg font-semibold leading-6 text-foreground">
            {issue?.title ?? `Issue #${bounty.issueNumber}`}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-foreground/65">
            <span className="font-medium uppercase tracking-wide text-foreground/35">Issue</span>
            {issue ? (
              <span
                className={
                  issue.state === "open"
                    ? "inline-flex items-center gap-1 text-emerald-500"
                    : "inline-flex items-center gap-1 text-purple-500"
                }
              >
                <CircleDotIcon className="size-3.5" />
                {issue.state}
              </span>
            ) : null}
            <span>#{bounty.issueNumber}</span>
            {issue ? (
              <span className="inline-flex items-center gap-1">
                <MessagesSquareIcon className="size-3.5" />
                {issue.comments} comments
              </span>
            ) : null}
          </div>

          {issue && issue.labels.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {issue.labels.map((label) => (
                <span
                  key={label.name}
                  className="rounded-full border px-2 py-0.5 text-[10px]"
                  style={{
                    borderColor: `#${label.color}66`,
                    color: `#${label.color}`,
                    backgroundColor: `#${label.color}14`,
                  }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <a
          href={issueUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-foreground/15 px-3.5 py-2 text-xs text-foreground transition-colors hover:border-foreground/40"
        >
          View on GitHub <ExternalLinkIcon className="size-3" />
        </a>
      </div>
      <div className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground/65">
          <span className="font-medium uppercase tracking-wide text-foreground/35">Repository</span>
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
                {compact(repo.stars)} stars
              </span>
              <span className="inline-flex items-center gap-1">
                <GitForkIcon className="size-3.5" />
                {compact(repo.forks)} forks
              </span>
              <span className="inline-flex items-center gap-1">
                <GitCommitVerticalIcon className="size-3.5" />
                {compact(activity?.commits ?? 0)} commits
              </span>
              <span className="inline-flex items-center gap-1">
                <GitPullRequestIcon className="size-3.5" />
                {compact(activity?.pullRequests ?? 0)} pull requests
              </span>
              <span className="inline-flex items-center gap-1">
                <CircleDotIcon className="size-3.5" />
                {compact(repo.openIssues)} open issues
              </span>
            </>
          ) : (
            <span className="text-foreground/65">
              {repoQuery.isLoading
                ? "loading…"
                : "stats unavailable — the on-chain data below is unaffected"}
            </span>
          )}
        </div>
        {repo?.description ? (
          <p className="mt-2 text-xs leading-relaxed text-foreground/65">{repo.description}</p>
        ) : null}
      </div>
    </div>
  );
}

function ClaimRow({ bounty, claim }: { bounty: Bounty; claim: Claim }) {
  const { data: pull } = usePullInfo(bounty.repo, claim.prNumber);
  const prUrl = `https://github.com/${bounty.repo}/pull/${claim.prNumber}`;
  const isWinner =
    bounty.status === "PAID" && bounty.paidTo?.toLowerCase() === claim.claimant.toLowerCase();

  return (
    <a
      href={prUrl}
      target="_blank"
      rel="noreferrer"
      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-foreground/10 px-4 py-3 transition-colors hover:border-foreground/25"
    >
      <div className="flex min-w-0 items-center gap-3">
        {pull?.authorLogin ? (
          <BlurImage
            src={avatarUrl(pull.authorLogin, 64)}
            alt={`@${pull.authorLogin}`}
            width={32}
            height={32}
            sizes="32px"
            className="size-8 shrink-0 rounded-full border border-foreground/10"
          />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5">
            <GitPullRequestIcon className="size-4 text-foreground/65" />
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-foreground">
            {pull?.title ?? `PR #${claim.prNumber}`}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-foreground/65">
            {pull?.authorLogin ? <span>@{pull.authorLogin}</span> : null}
            <span className="font-mono">{shorten(claim.claimant)}</span>
            {pull ? (
              <span>
                <span className="text-emerald-400">+{pull.additions}</span>{" "}
                <span className="text-red-400">−{pull.deletions}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {isWinner ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-sky-400">
            <GitMergeIcon className="size-3" /> paid
          </span>
        ) : pull?.merged ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-purple-400">
            <GitMergeIcon className="size-3" /> merged
          </span>
        ) : (
          <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-[10px] font-semibold uppercase text-foreground/65">
            {pull?.state ?? "pending"}
          </span>
        )}
      </div>
    </a>
  );
}

/**
 * A funded bounty whose issue GitHub already shows as closed.
 *
 * Not a dead end, and not an error: the escrow releases against a *merged pull
 * request*, not against the issue's state. Somebody almost certainly fixed it
 * without going through here, and that person can still claim. Saying nothing
 * is the bad outcome — the badge reads OPEN and a contributor starts work on
 * something that is already done.
 */
function StateNotice({ bounty }: { bounty: Bounty }) {
  const { address } = useAccount();
  const { data: issue } = useIssueInfo(bounty.repo, bounty.issueNumber);
  const status = displayStatus(bounty, issue?.state);
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status !== "STALE" && status !== "EXPIRED") {
    return null;
  }

  const reclaimable = canReclaim(bounty, address);

  async function reclaim() {
    setError(null);
    try {
      setTxHash(
        await writeContractAsync({
          address: ESCROW_ADDRESS,
          abi: ESCROW_ABI,
          functionName: "reclaim",
          args: [BigInt(bounty.bountyId)],
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message.split("\n")[0] : String(err));
    }
  }

  return (
    <div className="border-b border-amber-600/25 bg-amber-500/10 px-6 py-4">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
        <div className="text-xs leading-relaxed text-foreground/80">
          {status === "STALE" ? (
            <>
              <strong className="font-semibold text-foreground">
                Issue #{bounty.issueNumber} is already closed on GitHub.
              </strong>{" "}
              The reward is still escrowed, and payout is proven from a merged pull request rather
              than from the issue being open — so if your PR closed it, register your claim below.
              Otherwise the funder can take the reward back when it expires{" "}
              {timeLeft(bounty.expiresAt)}.
            </>
          ) : (
            <>
              <strong className="font-semibold text-foreground">This bounty has expired.</strong> No
              claim can settle against it now; the escrowed reward stays locked until the funder
              withdraws it.
            </>
          )}
          {reclaimable ? (
            <div className="mt-3">
              {txHash ? (
                <a
                  href={`${EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-emerald-700 underline"
                >
                  Reward returned — view transaction
                </a>
              ) : (
                <button
                  type="button"
                  onClick={reclaim}
                  disabled={isPending}
                  className="cursor-pointer rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPending ? "Confirm in wallet…" : `Reclaim ${formatFlr(bounty.amount)} FLR`}
                </button>
              )}
              {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Money and lifecycle up front; raw on-chain facts tucked underneath. */
function RewardPanel({ bounty }: { bounty: Bounty }) {
  const usdDenominated = bounty.rewardUsdCents !== "0";
  const headline = usdDenominated
    ? formatUsdCents(bounty.rewardUsdCents)
    : `${formatFlr(bounty.amount)} FLR`;

  return (
    <>
      <StateNotice bounty={bounty} />
      <div className="flex flex-col gap-6 border-b border-foreground/10 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-foreground/65">
            {bounty.status === "PAID" ? "Paid out" : "Reward"}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            {usdDenominated ? (
              <span className="text-4xl font-bold tracking-tight text-foreground">{headline}</span>
            ) : (
              <FlrAmount size="lg" className="text-4xl font-bold tracking-tight text-foreground">
                {formatFlr(bounty.amount)} FLR
              </FlrAmount>
            )}
          </div>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-foreground/65">
            {usdDenominated
              ? `Locked as ${formatFlr(bounty.amount)} FLR. The USD amount converts to FLR at the live FTSO price when it pays out, and any surplus returns to the funder.`
              : bounty.status === "PAID"
                ? "The full escrowed amount was released to the contributor who got their PR merged."
                : "The full escrowed amount goes to whoever gets a PR merged that closes this issue."}
          </p>
        </div>
        <div className="lg:w-1/2 lg:max-w-md">
          <BountyProgress bounty={bounty} />
        </div>
      </div>

      <details className="group border-b border-foreground/10">
        <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-3 text-xs font-medium text-foreground/65 transition-colors hover:text-foreground">
          On-chain details
          <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="divide-y divide-foreground/5 pb-2">
          <DetailRow label="Funded by" value={shorten(bounty.funder)} />
          <DetailRow
            label="Escrowed amount"
            value={<FlrAmount>{formatFlr(bounty.amount)} FLR</FlrAmount>}
          />
          {bounty.status === "PAID" && bounty.paidTo ? (
            <>
              <DetailRow label="Paid to" value={shorten(bounty.paidTo)} />
              <DetailRow
                label="Released"
                value={<FlrAmount>{formatFlr(bounty.paidAmount ?? "0")} FLR</FlrAmount>}
              />
              {bounty.refundedAmount && bounty.refundedAmount !== "0" ? (
                <DetailRow
                  label="Returned to funder"
                  value={<FlrAmount>{formatFlr(bounty.refundedAmount)} FLR</FlrAmount>}
                />
              ) : null}
            </>
          ) : (
            <DetailRow
              label="Funder can reclaim"
              value={`${new Date(Number(bounty.expiresAt) * 1000).toLocaleDateString()} (${timeLeft(bounty.expiresAt)})`}
            />
          )}
          <DetailRow
            label="Created"
            value={
              <a
                href={`${EXPLORER_URL}/tx/${bounty.createdTx}`}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-foreground/30 underline-offset-2"
              >
                {new Date(Number(bounty.createdAt) * 1000).toLocaleString()}
              </a>
            }
          />
          <DetailRow
            label="Escrow contract"
            value={
              <a
                href={`${EXPLORER_URL}/address/${ESCROW_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline decoration-foreground/30 underline-offset-2"
              >
                {shorten(ESCROW_ADDRESS)}
              </a>
            }
          />
        </div>
      </details>
    </>
  );
}

function ContributorsSection({ repo }: { repo: string }) {
  const { data: contributors } = useContributors(repo);
  if (!contributors || contributors.length === 0) {
    return null;
  }
  return (
    <div className="border-t border-foreground/10 px-5 py-5">
      <h2 className="text-sm font-semibold text-foreground">Contributors</h2>
      <p className="mt-0.5 text-xs text-foreground/65">
        Who maintains this repository — they review and merge your PR.
      </p>
      <div className="mt-6 flex justify-center pb-1 sm:justify-start">
        <ContributorStack repo={repo} size="lg" max={8} />
      </div>
    </div>
  );
}

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: bounty, isLoading } = useBounty(id);
  const { isConnected } = useAccount();
  const [claimOpen, setClaimOpen] = useState(false);
  // Hooks cannot sit behind the loading guards below, so resolve the issue with
  // whatever the bounty gives us and let the query no-op until it arrives.
  const { data: issue } = useIssueInfo(bounty?.repo ?? "", bounty?.issueNumber ?? "0");
  const headerStatus = bounty ? displayStatus(bounty, issue?.state) : "OPEN";

  if (isLoading) {
    return (
      <PageShell title={`Bounty #${id}`}>
        <div className="space-y-3 p-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </PageShell>
    );
  }

  if (!bounty) {
    return (
      <PageShell title={`Bounty #${id}`}>
        <div className="p-8 text-center text-sm text-foreground/65">
          Bounty not found on the indexer.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={
        <span className="flex items-center gap-3">
          Bounty #{bounty.bountyId} <StatusChip status={headerStatus} />
        </span>
      }
      actions={
        headerStatus !== "EXPIRED" && bounty.status === "OPEN" && isConnected ? (
          <button
            type="button"
            onClick={() => setClaimOpen(true)}
            className="cursor-pointer rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-80"
          >
            Register claim
          </button>
        ) : null
      }
    >
      <RepoHero bounty={bounty} />

      <RewardPanel bounty={bounty} />

      <ContributorsSection repo={bounty.repo} />

      <div className="border-t border-foreground/10 px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          Pull requests claiming this bounty ({bounty.claims.length})
        </h2>
        {bounty.claims.length === 0 ? (
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-foreground/65">
            {bounty.status === "PAID" ? (
              <>
                This bounty was settled through the confidential path — the enclave verified the
                merge privately, so no public claim was registered on-chain.
              </>
            ) : bounty.status === "RECLAIMED" ? (
              <>The funder reclaimed this bounty after it expired unclaimed.</>
            ) : (
              <>
                Nobody has claimed this yet. Open a PR that closes issue #{bounty.issueNumber}, then
                click <strong>Register claim</strong> to link it to your wallet — when a maintainer
                merges it, the escrow pays you automatically.
              </>
            )}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {bounty.claims.map((claim) => (
              <ClaimRow key={claim.id} bounty={bounty} claim={claim} />
            ))}
          </div>
        )}
      </div>

      {claimOpen ? (
        <RegisterClaimModal bountyId={bounty.bountyId} onClose={() => setClaimOpen(false)} />
      ) : null}
    </PageShell>
  );
}
