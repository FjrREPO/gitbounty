/** GitBounty on Flare Coston2 — contract, indexer, and provider catalog. */

export const ESCROW_ADDRESS = "0xa8adefe2c8f0f71a585a73c1259997f593f9e463" as const;

export const EXPLORER_URL = "https://coston2-explorer.flare.network";

/** Flare (FLR) token mark, also used as the chain logo (Coston2 = Flare testnet). */
export const FLR_LOGO = "https://assets.coingecko.com/coins/images/28624/small/FLR-icon200x200.png";

export const CHAIN = { name: "Coston2", symbol: "C2FLR" } as const;

export const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ??
  "https://api.goldsky.com/api/public/project_cm769b6m60y0a01sz7ze9ce2j/subgraphs/gitbounty-coston2/1.0.0/gn";

export const ESCROW_ABI = [
  {
    type: "function",
    name: "createBounty",
    stateMutability: "payable",
    inputs: [
      { name: "repo", type: "string" },
      { name: "issueNumber", type: "uint64" },
      { name: "rewardUsdCents", type: "uint128" },
      { name: "expiresAt", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "registerClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "prNumber", type: "uint256" },
      { name: "githubLoginHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "reclaim",
    stateMutability: "nonpayable",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [],
  },
] as const;

/** LLM options for the agent's bring-your-own-key model picker. */
export const LLM_PROVIDERS = [
  { name: "claude", defaultModel: "claude-opus-5" },
  { name: "openai", defaultModel: "gpt-5.1" },
  { name: "deepseek", defaultModel: "deepseek-chat" },
  { name: "qwen", defaultModel: "qwen3-coder-plus" },
  { name: "glm", defaultModel: "glm-4.6" },
  { name: "kimi", defaultModel: "kimi-k2-turbo-preview" },
  { name: "grok", defaultModel: "grok-code-fast-1" },
  { name: "gemini", defaultModel: "gemini-2.5-pro" },
  { name: "mistral", defaultModel: "codestral-latest" },
] as const;
