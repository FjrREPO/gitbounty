import { connect } from "node:net";

/** Unix socket the Confidential Space launcher exposes inside the enclave. */
export const LAUNCHER_SOCKET = "/run/container_launcher/teeserver.sock";

export interface AttestationRequest {
  /** Audience bound into the token, e.g. the escrow contract address. */
  audience: string;
  /** Arbitrary claims the verifier wants attested (we bind the signer key). */
  nonces?: string[];
}

/**
 * Fetches an attestation token from the Confidential Space launcher.
 *
 * The token is a JWT signed by Google's attestation service asserting which
 * container image is running in the enclave. Binding our signing key as a
 * nonce lets anyone confirm the key belongs to this exact published image.
 */
export async function fetchAttestationToken(
  request: AttestationRequest,
  socketPath = LAUNCHER_SOCKET,
): Promise<string> {
  const body = JSON.stringify({
    audience: request.audience,
    nonces: request.nonces ?? [],
    token_type: "OIDC",
  });

  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    let raw = "";

    socket.on("connect", () => {
      socket.write(
        [
          "POST /v1/token HTTP/1.1",
          "Host: localhost",
          "Content-Type: application/json",
          `Content-Length: ${Buffer.byteLength(body)}`,
          "Connection: close",
          "",
          body,
        ].join("\r\n"),
      );
    });
    socket.on("data", (chunk) => {
      raw += chunk.toString();
    });
    socket.on("error", reject);
    socket.on("end", () => {
      const separator = raw.indexOf("\r\n\r\n");
      if (separator === -1) {
        reject(new Error("malformed launcher response"));
        return;
      }
      const status = raw.slice(0, raw.indexOf("\r\n"));
      if (!status.includes("200")) {
        reject(new Error(`launcher returned: ${status}`));
        return;
      }
      resolve(raw.slice(separator + 4).trim());
    });
  });
}

/** Whether the process is running inside a Confidential Space enclave. */
export async function isEnclave(socketPath = LAUNCHER_SOCKET): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  return access(socketPath)
    .then(() => true)
    .catch(() => false);
}
