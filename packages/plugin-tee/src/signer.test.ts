import { recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { PayoutSigner, payoutDigest } from "./signer.js";

const KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const ESCROW = "0xa8adefe2c8f0f71a585a73c1259997f593f9e463" as const;
const RECIPIENT = "0x3B4f0135465d444a5bD06Ab90fC59B73916C85F5" as const;
const CHAIN_ID = 114;

describe("payoutDigest", () => {
  // Regression: the digest must stay byte-identical to the contract's
  // keccak256(abi.encode(chainId, escrow, bountyId, recipient)).
  it("is deterministic and binds every field", () => {
    const base = { chainId: CHAIN_ID, escrow: ESCROW, bountyId: 1n, recipient: RECIPIENT };
    const digest = payoutDigest(base);

    expect(digest).toBe(payoutDigest(base));
    expect(payoutDigest({ ...base, bountyId: 2n })).not.toBe(digest);
    expect(payoutDigest({ ...base, chainId: 14 })).not.toBe(digest);
    expect(payoutDigest({ ...base, recipient: ESCROW })).not.toBe(digest);
    expect(payoutDigest({ ...base, escrow: RECIPIENT })).not.toBe(digest);
  });
});

describe("PayoutSigner", () => {
  const signer = new PayoutSigner(KEY, CHAIN_ID, ESCROW);

  it("exposes the address the escrow must trust as teeSigner", () => {
    expect(signer.address).toBe(privateKeyToAccount(KEY).address);
  });

  it("produces an EIP-191 signature recoverable to the enclave key", async () => {
    const signature = await signer.sign(1n, RECIPIENT);
    const digest = payoutDigest({
      chainId: CHAIN_ID,
      escrow: ESCROW,
      bountyId: 1n,
      recipient: RECIPIENT,
    });

    expect(signature).toMatch(/^0x[0-9a-f]{130}$/);
    await expect(recoverMessageAddress({ message: { raw: digest }, signature })).resolves.toBe(
      signer.address,
    );
  });

  // Regression: a signature for one recipient must never authorize another.
  it("binds the recipient into the signature", async () => {
    const forRecipient = await signer.sign(1n, RECIPIENT);
    const otherDigest = payoutDigest({
      chainId: CHAIN_ID,
      escrow: ESCROW,
      bountyId: 1n,
      recipient: ESCROW,
    });

    await expect(
      recoverMessageAddress({ message: { raw: otherDigest }, signature: forRecipient }),
    ).resolves.not.toBe(signer.address);
  });
});
