# GitBounty

Trustless GitHub bounties on Flare — fund an issue, merge the PR, get paid on-chain.

## How it works

1. A maintainer escrows a USD-denominated reward on Flare, tied to a GitHub issue.
2. A developer opens a PR that fixes the issue.
3. On merge, the merge is verified trustlessly and the escrow pays the contributor.

## Built on Flare

- **FDC Web2Json** — attests GitHub API data on-chain for public repos, no centralized oracle.
- **Confidential Compute** — verifies merges inside a TEE for private repos and pseudonymous contributors.
- **FTSO v2** — converts USD rewards to FLR at payout time.

## Structure

```
packages/
  core/           Domain model, bounty state machine, provider interfaces
  plugin-github/  GitHub REST client
  plugin-fdc/     Web2Json attestation requests
  plugin-ftso/    FTSOv2 price provider
  plugin-tee/     Confidential merge verifier
```

## Development

Requires Node.js ≥ 22 and pnpm.

```bash
pnpm install
pnpm -r build
pnpm test
pnpm lint
```

Deployed against Coston2. Quality gates run on pre-commit, pre-push, and CI.

## License

MIT
