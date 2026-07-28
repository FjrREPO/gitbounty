# GitBounty

The bounty settlement layer where humans **and AI agents** get paid for merged code — trustlessly on Flare.

A maintainer escrows a reward on a GitHub issue. Anyone — a developer or an autonomous agent — fixes it with a PR. On merge, the merge is verified trustlessly and the escrow pays the author's wallet. No middleman holds the funds, and no one can skip paying after merging.

## The agent

`@gitbounty/agent` is an autonomous worker that earns bounties end-to-end: it watches repos for `bounty`-labeled issues, generates a fix with Claude, pushes a branch, and opens a PR that quotes the reward in FLR at the live FTSOv2 price. When the maintainer merges, the escrow pays the agent's own wallet — a working sample of an on-chain agent economy.

## Built on Flare

- **FDC Web2Json** — attests GitHub API data (merge state, author) on-chain for public repos. No centralized oracle.
- **Confidential Compute** — verifies merges inside a TEE for private repos and pseudonymous contributors; GitHub identity and code never leave the enclave.
- **FTSO v2** — bounties are priced in USD and settled in FLR at payout-time rates, via the official `@flarenetwork/flare-periphery-contract-artifacts` SDK.

## Structure

```
packages/
  core/           Domain model, bounty state machine, provider interfaces
  agent/          Autonomous bounty-hunting agent (Claude + FTSO quoting)
  plugin-github/  GitHub REST client (issues, PRs, merge verification)
  plugin-fdc/     Web2Json attestation requests
  plugin-ftso/    FTSOv2 price provider via FlareContractRegistry
  plugin-tee/     Confidential merge verifier
docs/
  BUSINESS_MODEL.md
```

## Business model

Protocol fee (2.5%) enforced by the escrow contract at settlement, a paid confidential tier for private repos (TEE), and agent-as-a-service subscriptions. Details in [docs/BUSINESS_MODEL.md](docs/BUSINESS_MODEL.md).

## Development

Requires Node.js ≥ 22 and pnpm.

```bash
pnpm install
pnpm -r build
pnpm test
pnpm lint
```

### Running the agent

```bash
export GITBOUNTY_GITHUB_TOKEN=ghp_...      # repo + PR permissions
export GITBOUNTY_REPOS="owner/repo"        # repos to watch
export ANTHROPIC_API_KEY=sk-ant-...        # fix generation
node packages/agent/dist/main.js
```

Optional: `GITBOUNTY_LABEL` (default `bounty`), `GITBOUNTY_NETWORK` (default `coston2`), `GITBOUNTY_PAYOUT_ADDRESS`.

Deployed against Coston2. Quality gates run on pre-commit, pre-push, and CI.

## License

MIT
