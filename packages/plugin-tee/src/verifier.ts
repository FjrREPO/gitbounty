import type {
  Bounty,
  Hex,
  PullRequestRef,
  VerificationProvider,
  VerificationResult,
} from "@gitbounty/core";
import { GitHubClient } from "@gitbounty/plugin-github";
import type { PayoutSigner } from "./signer.js";

export interface TeeVerifierConfig {
  /** GitHub token held inside the enclave; never leaves confidential memory. */
  githubToken: string;
  /** Signs the payout authorization the escrow contract verifies. */
  signer: PayoutSigner;
}

/**
 * Verifies PR merges inside a TEE (Google Confidential Space, Intel TDX).
 *
 * The GitHub token and the contributor's GitHub↔wallet link exist only in
 * enclave memory. What leaves the enclave is a signed payout authorization
 * the escrow contract recovers against its `teeSigner` — so private repos
 * stay private and contributors stay pseudonymous.
 */
export class TeeVerifier implements VerificationProvider {
  readonly mode = "tee" as const;
  private readonly github: GitHubClient;

  constructor(private readonly config: TeeVerifierConfig) {
    this.github = new GitHubClient(config.githubToken);
  }

  /** The address the escrow's `teeSigner` must be set to. */
  get signerAddress(): Hex {
    return this.config.signer.address;
  }

  async verify(
    bounty: Bounty,
    pullRequest: PullRequestRef,
    recipient: Hex,
  ): Promise<VerificationResult> {
    const state = await this.github.getPullRequestState(pullRequest);

    if (!state.merged) {
      throw new Error(`PR #${pullRequest.prNumber} is not merged`);
    }
    if (!state.closesIssues.includes(bounty.issue.issueNumber)) {
      throw new Error(
        `PR #${pullRequest.prNumber} does not close issue #${bounty.issue.issueNumber}`,
      );
    }

    const proof = await this.config.signer.sign(BigInt(bounty.id), recipient);
    return {
      bounty,
      pullRequest,
      merged: true,
      payoutAddress: recipient,
      proof,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
  }
}
