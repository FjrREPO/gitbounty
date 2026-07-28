# Enclave image for Google Confidential Space (Intel TDX).
# Built from the monorepo root: docker build -f packages/plugin-tee/Dockerfile .
FROM node:22-slim AS build
WORKDIR /repo

RUN corepack enable
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/plugin-github/package.json packages/plugin-github/
COPY packages/plugin-tee/package.json packages/plugin-tee/
RUN pnpm install --frozen-lockfile --filter @gitbounty/plugin-tee...

COPY packages/core packages/core
COPY packages/plugin-github packages/plugin-github
COPY packages/plugin-tee packages/plugin-tee
RUN pnpm --filter @gitbounty/plugin-tee... build && \
    pnpm deploy --filter @gitbounty/plugin-tee --prod /app

FROM node:22-slim
WORKDIR /app
COPY --from=build /app /app

# Confidential Space passes workload arguments as env vars; secrets are
# injected by the launcher and never persisted to the image.
ENV NODE_ENV=production PORT=8080
EXPOSE 8080

# Labels the Confidential Space launcher reads.
LABEL "tee.launch_policy.allow_env_override"="GITHUB_TOKEN,TEE_SIGNING_KEY,ESCROW_ADDRESS,CHAIN_ID"
LABEL "tee.launch_policy.log_redirect"="always"

CMD ["node", "dist/main.js"]
