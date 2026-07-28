# GitBounty — Business Model

## The problem we monetize

Open source maintenance is chronically underfunded, while companies increasingly want to pay for specific fixes without hiring. Existing bounty platforms (Gitcoin, Algora, IssueHunt) take custody of funds, exclude private repos, and have no story for AI agents as workers. GitBounty is the settlement layer where humans **and** autonomous agents get paid for merged code — trustlessly, and optionally confidentially.

## Revenue streams

### 1. Protocol fee on payouts (core)

A 2.5% fee on every bounty payout, taken by the escrow contract at settlement. The escrow is the choke point — funders lock rewards there because that is what makes the bounty credible — so the fee cannot be bypassed. Fees accrue in FLR to the protocol treasury.

- Unit economics: a $200 average bounty yields $5 per settlement, with near-zero marginal cost (verification via FDC/TEE is paid by the claimant as gas/attestation fees).

### 2. Private-repo verification tier (B2B SaaS)

Public-repo verification (FDC Web2Json) is free protocol infrastructure. Confidential verification — private repos and pseudonymous contributors through the TEE path — is the premium tier: a monthly subscription per organization (indicative: $99–499/mo by repo count) that covers enclave operating costs and margin. This is the moat: no competing bounty platform can serve closed-source codebases trustlessly.

### 3. First-party agent (agent economy revenue)

The GitBounty agent is both a demo and a business:

- **Agent as worker**: the agent earns bounties autonomously; operator margin = reward − inference/infra cost. The agent only picks up bounties above its cost floor.
- **Agent-as-a-service**: maintainers subscribe to have the agent watch their repos and auto-draft fixes for labeled issues, priced per repo per month.
- **Open agent market**: third-party agents pay the same 2.5% settlement fee as everyone else — more agents means more solved bounties, means more fee volume. We win from the ecosystem, not just our own agent.

### 4. Boosted bounties (later)

Funders pay a small listing fee to promote bounties to top agents and contributors. Deferred until liquidity exists.

## Why Flare makes the model defensible

- **Fee capture is contract-enforced** — FDC attestation and TEE proof both settle through the same escrow that takes the fee.
- **FTSO pricing** keeps bounties USD-denominated, which is what companies budget in, while settling in FLR — driving on-chain FLR volume.
- **Confidential Compute** creates the paid tier; it is the one capability competitors cannot replicate off-Flare without trusting a middleman.

## Path to first revenue

1. **Hackathon → mainnet beta**: escrow + fee switch live on Flare mainnet; seed with bounties on our own repos.
2. **Design partners**: 3–5 crypto-native OSS projects paying bounties through GitBounty (fee revenue), one closed-source team piloting the private tier (subscription revenue).
3. **Agent flywheel**: publish the agent SDK so third-party agents join; settlement volume compounds.
