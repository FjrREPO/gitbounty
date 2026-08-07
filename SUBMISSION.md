# GitBounty — Flare Summer Signal submission

## Project name

GitBounty

## Bounties entered

Both, with **Confidential Compute Apps** as the primary track:

- **Confidential Compute Apps** — the private claim path runs in a Google
  Confidential Space enclave (Intel TDX). It lets a contributor get paid
  without publicly linking their GitHub identity to a wallet, and lets a
  company fund bounties on a **private** repository, because the GitHub token
  and the identity mapping never leave enclave memory.
- **Interoperable Asset Products** — the public claim path settles FLR against
  an FDC Web2Json attestation of the GitHub API, with USD-denominated rewards
  converted at the FTSOv2 price at payout time.

## Product description

GitBounty is the settlement layer for paid open-source work. A funder escrows a
reward against a GitHub issue. Anyone — a human developer or an autonomous
agent — opens a pull request that fixes it. When a maintainer merges, the merge
is proven trustlessly and the escrow pays the author's wallet.

No middleman ever holds the money, and no one can merge the work and then skip
paying: the contract only releases funds against a proof it verifies itself.

## Target users

- **Maintainers and companies** who want to pay for a specific fix without
  hiring, and who need the payment promise to be credible.
- **Contributors**, including those who do not want their GitHub identity
  publicly tied to a wallet address.
- **Autonomous coding agents**, which become first-class economic participants:
  the same protocol pays a human and an agent identically.

## Demo

- **Repo:** https://github.com/FjrREPO/gitbounty
- **Demo repo the agent worked on:** https://github.com/FjrREPO/gitbounty-demo
  — issue [#1](https://github.com/FjrREPO/gitbounty-demo/issues/1) was solved
  autonomously by the agent in PR
  [#2](https://github.com/FjrREPO/gitbounty-demo/pull/2), merged, and paid out
  on-chain through both verification paths.
- **Video:** _(to record)_
- **Web app:** Next.js frontend in `apps/app` (bounty board, funding flow,
  claim registration, agent BYOK model picker).

## How it uses Flare

Three enshrined Flare protocols, each doing load-bearing work — the product
cannot be built the same way on another chain:

| Protocol | Role |
| --- | --- |
| **FDC Web2Json** | Answers "did this PR actually get merged?" on-chain. The validator set fetches the GitHub API, and the escrow verifies the Merkle proof itself, binding it to the exact repo and PR. Without it, this needs a trusted oracle operator — which destroys the trustlessness the product sells. |
| **Flare Confidential Compute** | Answers "how do we do that privately?" The verifier runs in Confidential Space and mints its signing key inside the enclave. The escrow verifies the Google attestation **on-chain** — RSA signature, enclave image digest, TDX hardware, expiry — and adopts the key it names, so `teeSigner` is provably that enclave rather than an operator's choice. |
| **FTSO v2** | Answers "how does a $500 bounty stay $500?" Rewards are denominated in USD and converted to FLR at the live feed price at payout time, with surplus escrow refunded to the funder. |

## What was newly built

Everything. Nothing existed before the program — first commit was made during
it, and the repository has 15 merged pull requests covering:

- `GitBountyEscrow`: UUPS-upgradeable escrow (Solidity 0.8.36, ERC-7201
  namespaced storage) with two independent claim paths, FTSO conversion,
  expiry reclaim, and enclave key rotation. 27 Foundry tests.
- FDC Web2Json integration: attestation request builder and a round-trip claim
  script (verifier → FDC hub → voting round → DA layer proof → claim).
- Confidential Space verifier: attestation client, payout signer matching the
  contract digest byte-for-byte, HTTP service, container image, deploy script.
- Autonomous agent: watches labelled issues, generates a fix, opens a PR
  quoting the reward in FLR at the live FTSO price. Ten LLM providers behind
  one registry, with bring-your-own-key entry points.
- Goldsky subgraph, a Go API that caches indexed data plus GitHub metadata in
  SQLite, and a Next.js frontend.

## Deployment (Coston2, chain id 114)

| Contract | Address |
| --- | --- |
| `GitBountyEscrow` (UUPS proxy) | [`0xa8adefe2c8f0f71a585a73c1259997f593f9e463`](https://coston2-explorer.flare.network/address/0xa8adefe2c8f0f71a585a73c1259997f593f9e463) |
| Implementation | [`0x9daf66b75d348d4f90b125a282bbfa608ecec13c`](https://coston2-explorer.flare.network/address/0x9daf66b75d348d4f90b125a282bbfa608ecec13c) |

Source verified on the Coston2 explorer. FtsoV2 and FdcVerification are
resolved through the FlareContractRegistry at deploy time, so the same code
runs unchanged on Songbird and mainnet.

Subgraph: `gitbounty-coston2` on Goldsky.

### Proof that both paths work

| Path | Transaction |
| --- | --- |
| FDC Web2Json | [`0xccdd041e…`](https://coston2-explorer.flare.network/tx/0xccdd041e560a503916a30c5b42dd2b25fb81a12651dd8e34834b881dc49b8509) |
| Confidential Compute — on-chain attestation registered the signer | [`0x97920460…`](https://coston2-explorer.flare.network/tx/0x979204605c769fa9069d149ad3f4a5ddb96fdac5bbe14411d704c4a106d0778e) |
| Confidential Compute — bounty paid against that signer | [`0xb4fafbff…`](https://coston2-explorer.flare.network/tx/0xb4fafbff8aa7d0f6f524af65db7bcc7337a05519913b1eba2191e40148555256) |

The confidential claim came from a verifier running on a live Confidential
Space VM. Its attestation decodes to `hwmodel: GCP_INTEL_TDX`,
`swname: CONFIDENTIAL_SPACE`, audience = the escrow address, and
`eat_nonce` = the signing key address.

## Roadmap

1. **Mainnet beta** — deploy to Flare mainnet with the protocol fee enabled.
2. **Private-repo pilot** — onboard one closed-source team onto the
   Confidential Compute path; harden with reproducible image builds, and
   attest Google's JWKS through an FDC verifier that can reach it (self-hosted,
   or the mainnet verifier) so the last owner-set value goes away.
3. **Agent marketplace** — publish the agent SDK so third-party agents compete
   for the same bounties.
4. **FAssets** — let bounties be funded and paid in FXRP, so XRP holders can
   fund open-source work without leaving their asset.

## Status and honest gaps

- Both claim paths are proven on testnet with real transactions, not mocks.
- The enclave mints its own signing key and never exports it, so the operator
  cannot forge payouts. The key does not survive a VM restart; sealing it to a
  KMS key released only against an attestation is the next hardening step.
- The escrow verifies the attestation itself, but the owner still registers
  Google's public key. It is a falsifiable commitment — the stored modulus is
  emitted in an event and anyone can diff it against Google's published JWKS —
  but it is not yet trustless.

  We tried to close this with FDC Web2Json and found the public testnet
  verifier cannot reach `googleapis.com` (`FETCH ERROR`, while Flare's own
  `swapi.info` example returns `VALID`), so the JWKS cannot be attested today.
  Mirroring the JWKS through a host the verifier *can* reach would only move
  the trust to that mirror, so we left the honest version in place.
- No production users yet — the traction so far is the working system itself.
