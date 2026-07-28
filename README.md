# GitBounty

Trustless GitHub bounties on Flare. Fund an issue, merge the PR, and the contributor gets paid on-chain — with optional private verification through Flare Confidential Compute.

## How it works

1. A maintainer locks a reward in an escrow contract on Flare, tied to a GitHub issue. Rewards are denominated in USD and converted to FLR at payout time using the FTSO price feed.
2. Any developer opens a PR referencing the issue (`Fixes #42`).
3. When the PR is merged, the merge is verified trustlessly and the escrow releases the reward to the contributor's wallet.

## Flare integration

| Protocol | Role |
| --- | --- |
| **FDC Web2Json** | Attests the GitHub API response (`merged`, `author`, PR number) on-chain for public repos — no centralized oracle. |
| **Flare Confidential Compute** | Verifies merges inside a TEE (Google Confidential Space, Intel TDX) for private repos and pseudonymous contributors. GitHub tokens and the GitHub↔wallet link never leave the enclave; the contract verifies the enclave's remote attestation. |
| **FTSO v2** | Live FLR/USD quotes (via the official `@flarenetwork/flare-periphery-contract-artifacts` SDK) so bounties keep a stable USD value. |

## Architecture

```
packages/
  core/           Domain types, bounty state machine, provider interfaces
  plugin-github/  Minimal GitHub REST client + closing-keyword parsing
  plugin-fdc/     Web2Json attestation request builder (public repos)
  plugin-ftso/    FTSOv2 price provider via FlareContractRegistry
  plugin-tee/     Confidential verifier composing the GitHub client inside the enclave
```

`core` owns the domain model and defines `VerificationProvider` / `PriceProvider` interfaces; each plugin implements exactly one concern and depends only on `core` (plus `plugin-github` for the TEE path). Escrow contracts and the web app land in upcoming packages.

## Development

Requires Node.js ≥ 22 and pnpm.

```bash
pnpm install        # install workspace dependencies
pnpm -r build       # build all packages (topological order)
pnpm test           # run the vitest suite
pnpm lint           # biome check
```

Quality gates: husky runs Biome on staged files at pre-commit and the full lint + build + test suite at pre-push; CI repeats the same checks on GitHub Actions.

### Reading a live FTSO quote (Coston2)

```ts
import { FLR_USD, FtsoPriceProvider } from "@gitbounty/plugin-ftso";

const provider = new FtsoPriceProvider({ network: "coston2" });
console.log(await provider.getQuote(FLR_USD));
```

## Networks

Developed against **Coston2** (Flare testnet, chain id 114). The FTSO provider also supports `songbird`, `coston`, and `flare` mainnet — contract addresses resolve through the FlareContractRegistry, which lives at the same address on every network.

## Roadmap

- [ ] Escrow contract (Solidity) with FDC proof verification, deployed to Coston2
- [ ] FDC attestation round-trip (request → validator consensus → Merkle proof)
- [ ] Confidential Space deployment with on-chain attestation checks
- [ ] Web app for funding bounties and linking wallets

## License

MIT
