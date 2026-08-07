"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { PageShell } from "@/components/ui/page-shell";
import { ESCROW_ABI, ESCROW_ADDRESS, EXPLORER_URL } from "@/config/gitbounty";

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the input is passed as children and rendered inside this label
    <label className="block">
      <span className="text-xs font-medium text-foreground/70">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-foreground/40">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-foreground/40";

export default function CreateBountyPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [repo, setRepo] = useState("");
  const [issue, setIssue] = useState("");
  const [amountFlr, setAmountFlr] = useState("");
  const [rewardUsd, setRewardUsd] = useState("");
  const [expiresDays, setExpiresDays] = useState("14");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid =
    REPO_PATTERN.test(repo) &&
    /^\d+$/.test(issue) &&
    Number(amountFlr) > 0 &&
    Number(expiresDays) > 0 &&
    (rewardUsd === "" || Number(rewardUsd) >= 0);

  async function submit() {
    setError(null);
    try {
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + Number(expiresDays) * 86_400);
      const rewardUsdCents = BigInt(Math.round(Number(rewardUsd || "0") * 100));
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "createBounty",
        args: [repo, BigInt(issue), rewardUsdCents, expiresAt],
        value: parseEther(amountFlr),
      });
      setTxHash(hash);
      setTimeout(() => router.push("/bounties"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message.split("\n")[0] : String(err));
    }
  }

  return (
    <PageShell title="Create bounty">
      <div className="mx-auto max-w-xl space-y-5 p-6">
        <p className="text-sm leading-relaxed text-foreground/60">
          Lock C2FLR against a GitHub issue. Whoever gets a fixing PR merged — human or agent — is
          paid trustlessly: FDC attests the merge for public repos, the Confidential Compute
          verifier covers private ones.
        </p>

        <Field label="Repository" hint='Format: "owner/name"'>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value.trim())}
            placeholder="FjrREPO/gitbounty"
            className={inputClass}
          />
        </Field>

        <Field label="Issue number">
          <input
            value={issue}
            onChange={(e) => setIssue(e.target.value.replace(/\D/g, ""))}
            placeholder="42"
            className={inputClass}
          />
        </Field>

        <Field label="Escrow amount (C2FLR)" hint="Locked in the contract until paid or reclaimed.">
          <input
            value={amountFlr}
            onChange={(e) => setAmountFlr(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="100"
            className={inputClass}
          />
        </Field>

        <Field
          label="Reward in USD (optional)"
          hint="If set, payout converts USD → FLR at the live FTSOv2 price; any surplus escrow is refunded to you."
        >
          <input
            value={rewardUsd}
            onChange={(e) => setRewardUsd(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="50"
            className={inputClass}
          />
        </Field>

        <Field label="Expires in (days)" hint="After expiry you can reclaim the escrow.">
          <input
            value={expiresDays}
            onChange={(e) => setExpiresDays(e.target.value.replace(/\D/g, ""))}
            className={inputClass}
          />
        </Field>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        {txHash ? (
          <a
            href={`${EXPLORER_URL}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="block text-center text-sm text-emerald-400 underline"
          >
            Bounty created — view transaction
          </a>
        ) : (
          <button
            type="button"
            disabled={!isConnected || !valid || isPending}
            onClick={submit}
            className="w-full cursor-pointer rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {!isConnected
              ? "Connect wallet to create"
              : isPending
                ? "Confirm in wallet…"
                : "Create bounty"}
          </button>
        )}
      </div>
    </PageShell>
  );
}
