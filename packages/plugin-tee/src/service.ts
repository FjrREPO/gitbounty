import { createServer, type Server } from "node:http";
import type { Bounty, Hex } from "@gitbounty/core";
import { fetchAttestationToken, isEnclave } from "./attestation.js";
import type { TeeVerifier } from "./verifier.js";

interface VerifyRequest {
  bountyId: string;
  repo: string;
  issueNumber: number;
  prNumber: number;
  recipient: Hex;
}

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/** Validates and normalizes an untrusted verify request. */
export function parseVerifyRequest(raw: unknown): VerifyRequest {
  const body = raw as Partial<VerifyRequest>;
  if (typeof body.bountyId !== "string" || !/^\d+$/.test(body.bountyId)) {
    throw new Error("bountyId must be a numeric string");
  }
  if (typeof body.repo !== "string" || !REPO_PATTERN.test(body.repo)) {
    throw new Error('repo must be "owner/name"');
  }
  if (!Number.isInteger(body.issueNumber) || (body.issueNumber ?? 0) <= 0) {
    throw new Error("issueNumber must be a positive integer");
  }
  if (!Number.isInteger(body.prNumber) || (body.prNumber ?? 0) <= 0) {
    throw new Error("prNumber must be a positive integer");
  }
  if (typeof body.recipient !== "string" || !ADDRESS_PATTERN.test(body.recipient)) {
    throw new Error("recipient must be a hex address");
  }
  return body as VerifyRequest;
}

/** Minimal bounty shape the verifier needs; the escrow holds the real one. */
function bountyFor(request: VerifyRequest): Bounty {
  const [owner, repo] = request.repo.split("/");
  return {
    id: request.bountyId as Hex,
    issue: {
      owner: owner ?? "",
      repo: repo ?? "",
      issueNumber: request.issueNumber,
      isPrivate: true,
    },
    rewardUsd: 0,
    funder: "0x",
    status: "verifying",
    mode: "tee",
    createdAt: 0,
    expiresAt: 0,
  };
}

export interface VerifierServiceOptions {
  verifier: TeeVerifier;
  escrowAddress: Hex;
  log?: (message: string, meta?: Record<string, unknown>) => void;
}

/**
 * HTTP surface of the enclave verifier.
 *
 * `POST /verify` proves a PR merge with the enclave-held GitHub token and
 * returns a payout signature plus the Confidential Space attestation token,
 * so callers can confirm which image produced the signature.
 */
export function createVerifierService(options: VerifierServiceOptions): Server {
  const { verifier, escrowAddress } = options;
  const log = options.log ?? (() => {});

  return createServer(async (req, res) => {
    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    };

    if (req.method === "GET" && req.url === "/healthz") {
      send(200, {
        status: "ok",
        signer: verifier.signerAddress,
        enclave: await isEnclave(),
      });
      return;
    }

    if (req.method !== "POST" || req.url !== "/verify") {
      send(404, { error: "not found" });
      return;
    }

    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16_384) {
        send(413, { error: "request too large" });
        return;
      }
    }

    let request: VerifyRequest;
    try {
      request = parseVerifyRequest(JSON.parse(body));
    } catch (error) {
      send(400, { error: error instanceof Error ? error.message : "invalid request" });
      return;
    }

    try {
      const [owner, repo] = request.repo.split("/");
      const result = await verifier.verify(
        bountyFor(request),
        { owner: owner ?? "", repo: repo ?? "", prNumber: request.prNumber },
        request.recipient,
      );
      // Bind the signing key into the attestation so a verifier can prove
      // the key belongs to this exact enclave image.
      const attestation = await fetchAttestationToken({
        audience: escrowAddress,
        nonces: [verifier.signerAddress],
      }).catch(() => null);

      log("authorized payout", {
        bountyId: request.bountyId,
        recipient: request.recipient,
      });
      send(200, {
        bountyId: request.bountyId,
        recipient: result.payoutAddress,
        signature: result.proof,
        signer: verifier.signerAddress,
        attestation,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("verification refused", { bountyId: request.bountyId, reason: message });
      send(422, { error: message });
    }
  });
}
