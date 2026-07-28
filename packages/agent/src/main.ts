import { FtsoPriceProvider } from "@gitbounty/plugin-ftso";
import { GitHubClient } from "@gitbounty/plugin-github";
import { BountyAgent } from "./agent.js";
import { loadConfig } from "./config.js";
import { chooseProvider, createGenerator } from "./provider.js";
import { Workspace } from "./workspace.js";

const config = loadConfig(process.env);
const generator = createGenerator(process.env);
console.info(`[gitbounty-agent] llm provider: ${chooseProvider(process.env).provider}`);

const agent = new BountyAgent(config, {
  github: new GitHubClient(config.githubToken),
  generator,
  workspace: new Workspace(config.workdir, config.githubToken),
  price: new FtsoPriceProvider({ network: config.network }),
  log: (message) => console.info(`[gitbounty-agent] ${message}`),
});

const report = await agent.runOnce();
console.info(
  `[gitbounty-agent] done: ${report.solved.length} solved, ${report.skipped.length} skipped`,
);
for (const solved of report.solved) {
  console.info(`  #${solved.issueNumber} -> ${solved.prUrl}`);
}
