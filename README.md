# GitBounty

Trustless GitHub bounties on Flare. Fund an issue, merge the PR, and the contributor gets paid on-chain — with optional private verification through Flare Confidential Compute.

## How it works

1. A maintainer locks a reward in an escrow contract on Flare, tied to a GitHub issue.
2. Any developer opens a PR referencing the issue.
3. When the PR is merged, the merge is verified trustlessly and the escrow releases the reward to the contributor's wallet.

## Verification paths

- **Public repos** — FDC Web2Json attestation of the GitHub API response.
- **Private repos / anonymous contributors** — verification inside a TEE (Google Confidential Space), so GitHub identity and repo data never leave the enclave.

## License

MIT
