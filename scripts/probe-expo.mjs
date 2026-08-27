import { loadProjectEnv } from "../lib/load-env.mjs";
import { listBuilds, listChannels, probeEasAuth } from "../lib/expo/eas-cli.mjs";
import { buildExpoUsageReport } from "../lib/expo/expo-client.mjs";
import { getExpoConfig, getExpoToken } from "../lib/expo/expo-env.mjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadProjectEnv(root);

const token = getExpoToken();

async function main() {
  const lines = [];
  lines.push(`Expo token loaded: ${Boolean(token)}`);
  lines.push(`Token length: ${token.length || 0}`);

  if (!token) {
    lines.push("EAS authenticated: false");
    lines.push("Account: null");
    lines.push("Project resolved: false");
    lines.push("Project ID: null");
    lines.push("Project slug: null");
    lines.push("Channels: 0");
    lines.push("Builds: 0");
    console.log(lines.join("\n"));
    return;
  }

  const auth = await probeEasAuth();
  lines.push(`EAS authenticated: ${auth.authenticated}`);
  lines.push(`Account: ${auth.account || "null"}${auth.role ? ` (Role: ${auth.role})` : ""}`);

  const report = await buildExpoUsageReport();
  const integration = report.integration || {};

  lines.push(`Project resolved: ${Boolean(integration.projectResolved)}`);
  lines.push(`Project ID: ${integration.projectId || "null"}`);
  lines.push(`Project slug: ${integration.projectSlug || getExpoConfig().slug || "null"}`);
  lines.push(`Full name: ${integration.fullName || getExpoConfig().fullName}`);
  lines.push(`Resolve method: ${integration.resolveMethod || "n/a"}`);
  lines.push(`Channels: ${integration.channelsCount ?? report.channels?.length ?? 0}`);
  lines.push(`Builds: ${integration.buildsCount ?? report.builds?.length ?? 0}`);

  if (!auth.authenticated) {
    lines.push(`Auth note: ${auth.error || "token rejected"}`);
  } else if (!integration.projectResolved) {
    lines.push(`Project note: ${report.error || "project not resolved"}`);
  } else if (integration.projectId) {
    const builds = listBuilds(integration.projectId, 3);
    const channels = listChannels(integration.projectId, 10);
    if (!builds.ok) lines.push(`Builds note: ${builds.error}`);
    if (!channels.ok) lines.push(`Channels note: ${channels.error}`);
  }

  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.log(`Probe failed safely: ${error instanceof Error ? error.message : "unknown"}`);
  process.exitCode = 1;
});
