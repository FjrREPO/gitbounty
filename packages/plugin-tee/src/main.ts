import { loadVerifierConfig } from "./config.js";
import { createVerifierService } from "./service.js";
import { PayoutSigner } from "./signer.js";
import { TeeVerifier } from "./verifier.js";

const config = loadVerifierConfig(process.env);
const signer = new PayoutSigner(config.signingKey, config.chainId, config.escrowAddress);
const verifier = new TeeVerifier({ githubToken: config.githubToken, signer });

const server = createVerifierService({
  verifier,
  escrowAddress: config.escrowAddress,
  log: (message, meta) => console.info(`[tee-verifier] ${message}`, meta ?? {}),
});

server.listen(config.port, () => {
  console.info(
    `[tee-verifier] listening on ${config.port} — signer ${signer.address}, escrow ${config.escrowAddress}, chain ${config.chainId}`,
  );
});
