import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildExpoUsageReport } from "../lib/expo/expo-client.mjs";
import { loadProjectEnv } from "../lib/load-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadProjectEnv(root);

function available(status) {
  return status === "ok";
}

const report = await buildExpoUsageReport();
const runtimes = new Set(
  [...(report.updates || []), ...(report.channelInsights || []), ...(report.updateInsights || [])]
    .map((row) => row.runtimeVersion)
    .filter(Boolean),
);
const platforms = (report.platformSplit || []).filter((row) => row.count != null);
const appVersions = (report.versionRows || []).filter((row) => row.version);

console.log(`Authenticated: ${Boolean(report.integration?.authenticated)}`);
console.log(`Channels found: ${report.channels?.length || 0}`);
console.log(`Runtime versions: ${runtimes.size}`);
console.log(`Unique users available: ${available(report.availability?.uniqueUsers) || available(report.availability?.otaUniqueUsers)}`);
console.log(`Launches available: ${available(report.availability?.launches)}`);
console.log(`Crash rate available: ${available(report.availability?.crashRate)}`);
console.log(`Platforms available: ${platforms.length > 0}`);
console.log(`App versions available: ${appVersions.length > 0}`);
console.log(`Observe available: ${available(report.availability?.observe)}`);

console.log("");
console.log("REAL DATA SUMMARY");
console.log("Unique users 7d: unavailable (deduplicated app total not returned)");
console.log("Unique users 30d: unavailable (deduplicated app total not returned)");
for (const row of report.channelInsights || []) {
  if (!row.responded) continue;
  console.log(`Update users ${row.channel} / ${String(row.runtimeVersion || "unknown").slice(0, 16)}: embedded=${row.embeddedUsers ?? "unavailable"}, OTA=${row.otaUsers ?? "unavailable"}`);
}
const launchesKpi = (report.headlineKpis || []).find((row) => row.key === "launches");
const crashRateKpi = (report.headlineKpis || []).find((row) => row.key === "crash_rate");
console.log(`Launches: ${launchesKpi?.status === "ok" ? launchesKpi.value : "unavailable"}`);
console.log(`Crash rate: ${crashRateKpi?.status === "ok" ? `${crashRateKpi.value}% (recent update scope)` : "unavailable"}`);
for (const row of report.updateInsights || []) {
  console.log(`Update ${row.groupId.slice(0, 8)}… / ${String(row.platform || "unknown").toUpperCase()}: uniqueUsers=${row.uniqueUsers?.value ?? "unavailable"}, launches=${row.launches?.value ?? "unavailable"}, crashRate=${row.crashRate?.value ?? "unavailable"}%`);
}
console.log(`Observe performance events: ${report.observe?.totalEvents ?? "unavailable"}`);
for (const row of report.platformSplit || []) {
  console.log(`Platform ${row.label}: ${row.count} performance events`);
}
for (const row of report.versionRows || []) {
  console.log(`App version ${row.version} / ${row.platform}: ${row.events} performance events`);
}
console.log(`Channels: ${(report.channels || []).map((row) => row.name).filter(Boolean).join(", ") || "none"}`);

if (!report.integration?.authenticated || !report.integration?.projectResolved) {
  process.exitCode = 1;
}
