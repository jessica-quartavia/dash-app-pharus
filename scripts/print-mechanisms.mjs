import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { buildMechanismsDataset, presentMechanismsPage } from "../lib/app-pharus/mechanisms-page.mjs";
import { formatPercent } from "../js/utils/format.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(ROOT);

const dataset = await buildMechanismsDataset();
const page = presentMechanismsPage(dataset, { period: "all" });
const byKey = Object.fromEntries(page.kpis.map((kpi) => [kpi.key, kpi]));

console.log(JSON.stringify({
  official: dataset.populationTotal,
  catalog: dataset.catalog.length,
  implementations: byKey.implementations.value,
  withMechanisms: byKey.with.value,
  withoutMechanisms: byKey.without.value,
  coverage: formatPercent(byKey.coverage.value),
  median: byKey.median.value,
  lastImplemented: byKey.last.value,
  qtyZero: page.qtyDist.find((item) => item.label === "0")?.count,
}, null, 2));
