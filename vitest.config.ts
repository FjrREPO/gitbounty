import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const pkg = (name: string) => resolve(import.meta.dirname, `packages/${name}/src/index.ts`);

export default defineConfig({
  resolve: {
    alias: {
      "@gitbounty/core": pkg("core"),
      "@gitbounty/plugin-github": pkg("plugin-github"),
      "@gitbounty/plugin-fdc": pkg("plugin-fdc"),
      "@gitbounty/plugin-ftso": pkg("plugin-ftso"),
      "@gitbounty/plugin-tee": pkg("plugin-tee"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
    environment: "node",
  },
});
