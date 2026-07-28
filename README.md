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
```

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
export ANTHROPIC_API_KEY=sk-ant-...        # fix generation (Claude, preferred)
node packages/agent/dist/main.js
```

The LLM is pluggable — set any one key: `ANTHROPIC_API_KEY` (Claude, preferred), `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `QWEN_API_KEY`, `GLM_API_KEY`, `KIMI_API_KEY`, `XAI_API_KEY` (Grok), `GEMINI_API_KEY`, `MISTRAL_API_KEY`, or any OpenAI-compatible endpoint via `LLM_API_KEY` + `LLM_BASE_URL` + `LLM_MODEL`. Force one with `GITBOUNTY_LLM`; override models with `<PROVIDER>_MODEL`.

Optional: `GITBOUNTY_LABEL` (default `bounty`), `GITBOUNTY_NETWORK` (default `coston2`), `GITBOUNTY_PAYOUT_ADDRESS`.

Quality gates run on pre-commit, pre-push, and CI (Biome, vitest, `forge fmt`, `forge test`).

## Deployment (Coston2)

| Contract | Address |
| --- | --- |
| `GitBountyEscrow` (UUPS proxy) | [`0xa8adefe2c8f0f71a585a73c1259997f593f9e463`](https://coston2-explorer.flare.network/address/0xa8adefe2c8f0f71a585a73c1259997f593f9e463) |
| Implementation | [`0x9daf66b75d348d4f90b125a282bbfa608ecec13c`](https://coston2-explorer.flare.network/address/0x9daf66b75d348d4f90b125a282bbfa608ecec13c) |

Source verified on the Coston2 explorer. FtsoV2 and FdcVerification are resolved through the FlareContractRegistry at deploy time.

## License

MIT
