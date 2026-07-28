import type {
  Bounty,
  Hex,
  PullRequestRef,
  VerificationProvider,
  VerificationResult,
} from "@gitbounty/core";
import { GitHubClient } from "@gitbounty/plugin-github";

export interface TeeVerifierConfig {
  /** GitHub token held inside the enclave; never leaves confidential memory. */
  githubToken: string;
  /** Wallet the contributor linked to their GitHub identity inside the enclave. */
  payoutAddress: Hex;
}

/**
 * Verifies PR merges inside a TEE (Google Confidential Space, Intel TDX).
 *
 * The GitHub token and the contributor's GitHub<->wallet link exist only in
 * enclave memory. What leaves the enclave is a signed payout authorization
 * plus a remote attestation the escrow contract verifies on-chain — so
 * private repos stay private and contributors stay pseudonymous.
 */
export class TeeVerifier implements VerificationProvider {
  readonly mode = "tee" as const;
  private readonly github: GitHubClient;

  constructor(private readonly config: TeeVerifierConfig) {
    this.github = new GitHubClient(config.githubToken);
  }

  async verify(bounty: Bounty, pullRequest: PullRequestRef): Promise<VerificationResult> {
    const state = await this.github.getPullRequestState(pullRequest);

    if (!state.merged) {
      throw new Error(`PR #${pullRequest.prNumber} is not merged`);
    }
    if (!state.closesIssues.includes(bounty.issue.issueNumber)) {
      throw new Error(
        `PR #${pullRequest.prNumber} does not close issue #${bounty.issue.issueNumber}`,
      );
    }

    return {
      bounty,
      pullRequest,
      merged: true,
      payoutAddress: this.config.payoutAddress,
      // TODO: replace with a real enclave signature + remote attestation quote
      // once the Confidential Space deployment lands.
      proof: "0x",
      verifiedAt: Math.floor(Date.now() / 1000),
    };
  }
}
