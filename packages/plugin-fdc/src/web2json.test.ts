import { describe, expect, it } from "vitest";
import { buildPrMergeAttestationRequest } from "./web2json.js";

describe("buildPrMergeAttestationRequest", () => {
  const request = buildPrMergeAttestationRequest({
    owner: "flare-foundation",
    repo: "flare-ai-kit",
    prNumber: 128,
  });

  it("targets the exact GitHub pulls endpoint", () => {
    expect(request.url).toBe(
      "https://api.github.com/repos/flare-foundation/flare-ai-kit/pulls/128",
    );
    expect(request.httpMethod).toBe("GET");
    expect(request.attestationType).toBe("Web2Json");
  });

  it("extracts only the fields the escrow contract verifies", () => {
    expect(request.postProcessJq).toContain(".merged");
    expect(request.postProcessJq).toContain(".user.login");
    expect(request.postProcessJq).toContain(".number");
  });

  it("declares an abi signature matching the jq output shape", () => {
    const abi = JSON.parse(request.abiSignature) as {
      components: { name: string; type: string }[];
    };
    expect(abi.components.map((c) => c.name)).toEqual(["merged", "author", "prNumber"]);
    expect(abi.components.map((c) => c.type)).toEqual(["bool", "string", "uint256"]);
  });
});
