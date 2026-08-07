// FDC Web2Json round-trip for the public-repo claim path: attest that a pull
// request is merged, then claim the bounty with the resulting Merkle proof.
//
//   PK=0x... BOUNTY_ID=3 REPO=owner/name PR=2 node packages/plugin-fdc/scripts/claim.mjs
//
// The contributor must have called registerClaim(bountyId, prNumber, keccak256(login))
// from the wallet that runs this script.
import {
  createPublicClient,
  createWalletClient,
  decodeAbiParameters,
  http,
  parseAbi,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { flareTestnet } from "viem/chains";

const PK = process.env.PK;
const BOUNTY_ID = BigInt(process.env.BOUNTY_ID);
const REPO = process.env.REPO;
const PR = Number(process.env.PR);
const ESCROW = process.env.ESCROW_ADDRESS ?? "0xa8adefe2c8f0f71a585a73c1259997f593f9e463";

const REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
const VERIFIER =
  "https://fdc-verifiers-testnet.flare.network/verifier/web2/Web2Json/prepareRequest";
const VERIFIER_KEY = process.env.VERIFIER_API_KEY ?? "00000000-0000-0000-0000-000000000000";
const DA_LAYER =
  "https://ctn2-data-availability.flare.network/api/v1/fdc/proof-by-request-round-raw";

const account = privateKeyToAccount(PK);
const transport = http("https://coston2-api.flare.network/ext/C/rpc");
const pub = createPublicClient({ chain: flareTestnet, transport });
const wallet = createWalletClient({ account, chain: flareTestnet, transport });

const registryAbi = parseAbi(["function getContractAddressByName(string) view returns (address)"]);
const addr = (name) =>
  pub.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "getContractAddressByName",
    args: [name],
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The response shape the escrow decodes; keep in sync with IGitBountyEscrow.
const RESPONSE = [
  {
    type: "tuple",
    components: [
      { name: "attestationType", type: "bytes32" },
      { name: "sourceId", type: "bytes32" },
      { name: "votingRound", type: "uint64" },
      { name: "lowestUsedTimestamp", type: "uint64" },
      {
        name: "requestBody",
        type: "tuple",
        components: [
          { name: "url", type: "string" },
          { name: "httpMethod", type: "string" },
          { name: "headers", type: "string" },
          { name: "queryParams", type: "string" },
          { name: "body", type: "string" },
          { name: "postProcessJq", type: "string" },
          { name: "abiSignature", type: "string" },
        ],
      },
      {
        name: "responseBody",
        type: "tuple",
        components: [{ name: "abiEncodedData", type: "bytes" }],
      },
    ],
  },
];

// 1. Let the verifier encode (and message-integrity-check) the request.
const prepared = await fetch(VERIFIER, {
  method: "POST",
  headers: { "X-API-KEY": VERIFIER_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    attestationType: toHex("Web2Json", { size: 32 }),
    sourceId: toHex("PublicWeb2", { size: 32 }),
    requestBody: {
      url: `https://api.github.com/repos/${REPO}/pulls/${PR}`,
      httpMethod: "GET",
      headers: "{}",
      queryParams: "{}",
      body: "{}",
      postProcessJq: "{merged: .merged, author: .user.login, prNumber: .number}",
      abiSignature:
        '{"components":[{"internalType":"bool","name":"merged","type":"bool"},{"internalType":"string","name":"author","type":"string"},{"internalType":"uint256","name":"prNumber","type":"uint256"}],"name":"prMerge","type":"tuple"}',
    },
  }),
}).then((r) => r.json());
if (prepared.status !== "VALID") {
  throw new Error(`verifier rejected the request: ${JSON.stringify(prepared)}`);
}
const encoded = prepared.abiEncodedRequest;
console.log("1/4 request prepared");

// 2. Submit it to the FDC hub with the configured fee.
const fee = await pub.readContract({
  address: await addr("FdcRequestFeeConfigurations"),
  abi: parseAbi(["function getRequestFee(bytes) view returns (uint256)"]),
  functionName: "getRequestFee",
  args: [encoded],
});
const requestHash = await wallet.writeContract({
  address: await addr("FdcHub"),
  abi: parseAbi(["function requestAttestation(bytes) payable"]),
  functionName: "requestAttestation",
  args: [encoded],
  value: fee,
});
const receipt = await pub.waitForTransactionReceipt({ hash: requestHash });

const systems = await addr("FlareSystemsManager");
const systemsAbi = parseAbi([
  "function firstVotingRoundStartTs() view returns (uint64)",
  "function votingEpochDurationSeconds() view returns (uint64)",
]);
const block = await pub.getBlock({ blockNumber: receipt.blockNumber });
const [start, duration] = await Promise.all([
  pub.readContract({ address: systems, abi: systemsAbi, functionName: "firstVotingRoundStartTs" }),
  pub.readContract({
    address: systems,
    abi: systemsAbi,
    functionName: "votingEpochDurationSeconds",
  }),
]);
const roundId = Number((block.timestamp - BigInt(start)) / BigInt(duration));
console.log(`2/4 attested in voting round ${roundId} (${requestHash})`);

// 3. Poll the DA layer until the round finalizes and the proof is published.
let proof;
for (let attempt = 0; attempt < 80; attempt++) {
  proof = await fetch(DA_LAYER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ votingRoundId: roundId, requestBytes: encoded }),
  }).then((r) => r.json());
  if (proof.response_hex) break;
  process.stdout.write(".");
  await sleep(15_000);
}
if (!proof.response_hex) {
  throw new Error(`no proof after waiting: ${JSON.stringify(proof)}`);
}
const [data] = decodeAbiParameters(RESPONSE, proof.response_hex);
console.log(`\n3/4 proof retrieved for ${data.requestBody.url}`);

// 4. Claim. The escrow re-checks the attested URL, merge state, and author.
const escrowAbi = [
  ...[
    "NotOpen",
    "NoClaim",
    "InvalidProof",
    "UrlMismatch",
    "PrNotMerged",
    "AuthorMismatch",
    "TransferFailed",
  ].map((name) => ({ type: "error", name, inputs: [] })),
  {
    type: "function",
    name: "claimWithFdcProof",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      {
        name: "proof",
        type: "tuple",
        components: [
          { name: "merkleProof", type: "bytes32[]" },
          { ...RESPONSE[0], name: "data" },
        ],
      },
    ],
    outputs: [],
  },
];
const claimHash = await wallet.writeContract({
  address: ESCROW,
  abi: escrowAbi,
  functionName: "claimWithFdcProof",
  args: [BOUNTY_ID, { merkleProof: proof.proof, data }],
});
const claimReceipt = await pub.waitForTransactionReceipt({ hash: claimHash });
console.log(`4/4 claim ${claimReceipt.status}: ${claimHash}`);
