import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVerifierService, parseVerifyRequest } from "./service.js";
import { PayoutSigner } from "./signer.js";
import { TeeVerifier } from "./verifier.js";

const KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const ESCROW = "0xa8adefe2c8f0f71a585a73c1259997f593f9e463" as const;
const RECIPIENT = "0x3B4f0135465d444a5bD06Ab90fC59B73916C85F5" as const;

// The tests stub global fetch for the enclave's GitHub client; keep the real
// one for talking to the service under test.
const realFetch = globalThis.fetch.bind(globalThis);

const validRequest = {
  bountyId: "1",
  repo: "acme/private-api",
  issueNumber: 42,
  prNumber: 7,
  recipient: RECIPIENT,
};

describe("parseVerifyRequest", () => {
  it("accepts a well-formed request", () => {
    expect(parseVerifyRequest(validRequest)).toEqual(validRequest);
  });

  it("rejects malformed fields", () => {
    expect(() => parseVerifyRequest({ ...validRequest, bountyId: "abc" })).toThrow(/bountyId/);
    expect(() => parseVerifyRequest({ ...validRequest, repo: "no-slash" })).toThrow(/repo/);
    expect(() => parseVerifyRequest({ ...validRequest, issueNumber: 0 })).toThrow(/issueNumber/);
    expect(() => parseVerifyRequest({ ...validRequest, prNumber: -1 })).toThrow(/prNumber/);
    expect(() => parseVerifyRequest({ ...validRequest, recipient: "0xdead" })).toThrow(/recipient/);
  });
});

function stubPr(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          merged: true,
          merged_at: "2026-07-28T10:00:00Z",
          user: { login: "anon-dev" },
          body: "Fixes #42",
          ...overrides,
        }),
        { status: 200 },
      ),
    ),
  );
}

async function withService<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const signer = new PayoutSigner(KEY, 114, ESCROW);
  const verifier = new TeeVerifier({ githubToken: "enclave-token", signer });
  const server = createVerifierService({ verifier, escrowAddress: ESCROW });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("verifier service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("signs a payout for a merged PR that closes the issue", async () => {
    stubPr();
    const body = await withService(async (baseUrl) => {
      const res = await realFetch(`${baseUrl}/verify`, {
        method: "POST",
        body: JSON.stringify(validRequest),
      });
      expect(res.status).toBe(200);
      return res.json() as Promise<Record<string, unknown>>;
    });

    expect(body.signature).toMatch(/^0x[0-9a-f]{130}$/);
    expect(body.recipient).toBe(RECIPIENT);
    // No launcher socket outside an enclave — attestation degrades to null.
    expect(body.attestation).toBeNull();
  });

  // Regression: an unmerged PR must never yield a signature.
  it("refuses an unmerged PR", async () => {
    stubPr({ merged: false });
    const status = await withService(async (baseUrl) => {
      const res = await realFetch(`${baseUrl}/verify`, {
        method: "POST",
        body: JSON.stringify(validRequest),
      });
      return res.status;
    });
    expect(status).toBe(422);
  });

  // Regression: a merged PR closing a different issue must not pay out.
  it("refuses a PR that closes another issue", async () => {
    stubPr({ body: "Fixes #99" });
    const status = await withService(async (baseUrl) => {
      const res = await realFetch(`${baseUrl}/verify`, {
        method: "POST",
        body: JSON.stringify(validRequest),
      });
      return res.status;
    });
    expect(status).toBe(422);
  });

  it("rejects a malformed request with 400", async () => {
    const status = await withService(async (baseUrl) => {
      const res = await realFetch(`${baseUrl}/verify`, {
        method: "POST",
        body: JSON.stringify({ ...validRequest, recipient: "nope" }),
      });
      return res.status;
    });
    expect(status).toBe(400);
  });

  it("reports health with the signer address", async () => {
    const body = await withService(async (baseUrl) => {
      const res = await realFetch(`${baseUrl}/healthz`);
      return res.json() as Promise<Record<string, unknown>>;
    });
    expect(body.status).toBe("ok");
    expect(body.signer).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(body.enclave).toBe(false);
  });
});
