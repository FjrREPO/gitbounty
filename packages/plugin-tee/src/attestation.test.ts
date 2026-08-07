import { describe, expect, it } from "vitest";
import { dechunk } from "./attestation.js";

describe("dechunk", () => {
  // Regression: the launcher streams the attestation token chunked, so the
  // hex chunk sizes must never leak into the JWT.
  it("reassembles a chunked body without the size markers", () => {
    expect(dechunk("3\r\neyJ\r\n4\r\nhbGc\r\n0\r\n\r\n")).toBe("eyJhbGc");
  });

  it("handles a single chunk and trailing whitespace", () => {
    expect(dechunk("5\r\nabcde\r\n0\r\n\r\n")).toBe("abcde");
  });
});
