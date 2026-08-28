import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { buildGa4UsageDataset } from "../lib/firebase-analytics/usage.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(root);
const end = new Date();
const start = new Date(end);
start.setUTCDate(start.getUTCDate() - 6);
const result = await buildGa4UsageDataset(
  { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) },
  { force: true },
);

console.log(`GA4 authenticated: ${Boolean(result.integration?.authenticated)}`);
console.log(`Property resolved: ${Boolean(result.integration?.propertyResolved)}`);
console.log(`Rows returned: ${Number(result.diagnostics?.rowsReturned || 0)}`);
console.log(`Error: ${result.available ? "none" : result.userMessage || "unknown"}`);
