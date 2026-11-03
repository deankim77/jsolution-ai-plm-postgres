import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Set the environment before Vite, Vinext or React can be imported. Changing it
// inside vite.config is too late for modules already cached by the CLI.
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
  "--config", "vite.node.config.ts",
  "--configLoader", "native",
  "--port", "5174",
  ...process.argv.slice(2),
], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});

if (result.error) {
  console.error(result.error);
}
process.exitCode = result.status ?? 1;
