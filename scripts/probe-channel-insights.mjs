import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverChannelRuntimePairs, fetchChannelInsights, parseChannelInsights } from "../lib/expo/channel-insights.mjs";
import { fetchObserveEvents, fetchObserveMetricsSummary, parseObserveMetricsSummary } from "../lib/expo/observe.mjs";
import { buildExpoUsageReport } from "../lib/expo/expo-client.mjs";
import { listChannels } from "../lib/expo/eas-cli.mjs";
import { loadProjectEnv } from "../lib/load-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadProjectEnv(root);

const report = await buildExpoUsageReport();
const projectId = report.integration?.projectId;
if (!projectId) {
  console.log(JSON.stringify({ error: "project not resolved", integration: report.integration }, null, 2));
  process.exit(0);
}

const channelsResult = listChannels(projectId, 25);
const discovered = discoverChannelRuntimePairs(projectId);

console.log("=== CHANNELS ===");
console.log(JSON.stringify(channelsResult.rows?.map((row) => row.name) || [], null, 2));

console.log("\n=== RUNTIME PAIRS ===");
console.log(JSON.stringify(discovered.pairs || [], null, 2));

const insightsResults = [];
for (const pair of discovered.pairs || []) {
  const fetched = fetchChannelInsights(projectId, {
    channel: pair.channel,
    runtimeVersion: pair.runtimeVersion,
    days: 30,
  });
  insightsResults.push({
    ...pair,
    ok: fetched.ok,
    error: fetched.error || null,
    parsed: fetched.ok ? parseChannelInsights(fetched.data) : null,
  });
}

console.log("\n=== INSIGHTS SUMMARY ===");
for (const item of insightsResults) {
  console.log(
    `${item.channel} / ${String(item.runtimeVersion).slice(0, 12)}… → embedded=${item.parsed?.embeddedUniqueUsers ?? "n/a"} ota=${item.parsed?.otaUniqueUsers ?? "n/a"} failed=${item.parsed?.failedInstalls ?? "n/a"}`,
  );
}

const observeSummary = fetchObserveMetricsSummary(projectId);
const observeEvents = fetchObserveEvents(projectId);
const observeParsed = observeSummary.ok ? parseObserveMetricsSummary(observeSummary.data) : null;

console.log("\n=== OBSERVE ===");
console.log(
  JSON.stringify(
    {
      metricsSummaryOk: observeSummary.ok,
      eventsOk: observeEvents.ok,
      eventsError: observeEvents.error || null,
      totalEvents: observeParsed?.totalEvents ?? null,
      platforms: observeParsed?.platformSplit || [],
    },
    null,
    2,
  ),
);

writeFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "probe-insights-output.json"),
  JSON.stringify(
    {
      channels: channelsResult.rows,
      pairs: discovered.pairs,
      insights: insightsResults.map((item) => ({
        channel: item.channel,
        runtimeVersion: item.runtimeVersion,
        source: item.source,
        ok: item.ok,
        error: item.error,
        embeddedUniqueUsers: item.parsed?.embeddedUniqueUsers ?? null,
        otaUniqueUsers: item.parsed?.otaUniqueUsers ?? null,
        failedInstalls: item.parsed?.failedInstalls ?? null,
      })),
      observe: {
        metricsSummaryOk: observeSummary.ok,
        eventsOk: observeEvents.ok,
        eventsError: observeEvents.error || null,
        parsed: observeParsed,
      },
    },
    null,
    2,
  ),
);
