import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { buildOverview } from "../lib/app-pharus/overview.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(ROOT);

const overview = await buildOverview();
const slim = {
  source: overview.source,
  clientBase: overview.clientBase,
  denominator: overview.denominator,
  kpis: overview.kpis,
  monthly: overview.monthly,
  debug: overview.debug,
};
console.log(JSON.stringify(slim, null, 2));
