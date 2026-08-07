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
    `[tee-verifier] listening on ${config.port} — escrow ${config.escrowAddress}, chain ${config.chainId}`,
  );
  console.info(`[tee-verifier] signer address: ${signer.address}`);
  if (config.keyWasInjected) {
    console.warn(
      "[tee-verifier] signing key was injected — whoever supplied it can forge payouts; omit TEE_SIGNING_KEY to generate one inside the enclave",
    );
  } else {
    console.info(
      "[tee-verifier] key generated inside the enclave — set the escrow's teeSigner to the address above",
    );
  }
});
