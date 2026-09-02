import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { envPresence } from "../lib/env-presence.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(root);

process.env.VERCEL = "1";

const { buildExpoUsageDataset } = await import("../lib/expo/usage-page.mjs");
const payload = await buildExpoUsageDataset({});
const runtimes = payload.runtimes || payload.updates || [];
console.log(JSON.stringify({
  env: envPresence(process.env, ["EXPO_ACCESS_TOKEN", "EXPO_ACCOUNT", "EXPO_PROJECT_SLUG"]),
  ok: payload.ok,
  available: payload.available,
  projectResolved: payload.integration?.projectResolved,
  capabilities: payload.capabilities,
  channels: (payload.channels || []).length,
  channelNames: (payload.channels || []).map((row) => row.name),
  runtimes: runtimes.length,
  versions: (payload.versionRows || []).length,
  updates: (payload.updates || []).length,
  builds: (payload.builds || []).length,
  insights: (payload.channelInsights || []).length,
  updateInsights: (payload.updateInsights || []).length,
  error: payload.error || payload.userMessage || null,
}, null, 2));
