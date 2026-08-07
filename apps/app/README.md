# @gitbounty/app

The GitBounty web app — browse funded bounties, fund one against a GitHub
issue, and claim a merged pull request.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Landing page |
| `/bounties` | The board: every bounty with its repository stats, filterable by status |
| `/bounties/[id]` | One bounty — issue detail, contributors, reward, and the claim flow |
| `/create` | Fund a bounty: pick a repo and issue, set a fixed FLR or USD-denominated reward |
| `/agent` | Configure the autonomous agent — pick an LLM provider and supply your own key |

## Where the data comes from

Bounties are read from the Goldsky subgraph, falling back to reading the escrow
over RPC when `NEXT_PUBLIC_SUBGRAPH_URL` is empty.

Repository and issue metadata comes from the Go API in `apps/api`, which caches
GitHub responses in SQLite. That indirection is the point: without it every
visitor would spend the browser's own 60-requests-per-hour anonymous GitHub
budget and the board would stop loading. If the API is unreachable the app falls
back to calling GitHub directly, unauthenticated — deliberately, because any
`NEXT_PUBLIC_` variable ends up inside the client bundle where a token would be
readable by every visitor.

Wallet connection is Reown AppKit over wagmi/viem, on Flare Coston2 (chain 114).

## Running it

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_REOWN_PROJECT_ID
bun install
bun dev
```

The API is expected on `http://localhost:8080` by default:

```bash
cd ../api && make run
```
