import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverChannelRuntimePairs, fetchChannelInsights } from "../lib/expo/channel-insights.mjs";
import { buildExpoUsageReport } from "../lib/expo/expo-client.mjs";
import { fetchObserveMetricsSummary } from "../lib/expo/observe.mjs";
import { loadProjectEnv } from "../lib/load-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadProjectEnv(root);

const report = await buildExpoUsageReport();
const projectId = report.integration?.projectId;
if (!projectId) {
  console.log(JSON.stringify({ error: "no project" }, null, 2));
  process.exit(0);
}

function pickInsightsFields(data) {
  if (!data) return null;
  const failed = (data.cumulativeMetricsAtLastTimestamp || []).find((item) =>
    /failed/i.test(String(item.label || item.id || "")),
  );
  const labels = data.uniqueUsersOverTime?.labels || [];
  const values = data.uniqueUsersOverTime?.datasets?.[0]?.data || [];
  const firstNonZeroIdx = values.findIndex((v) => Number(v) > 0);
  return {
    channel: data.channel,
    runtimeVersion: data.runtimeVersion,
    timespan: data.timespan || null,
    embeddedUpdateTotalUniqueUsers: data.embeddedUpdateTotalUniqueUsers,
    otaTotalUniqueUsers: data.otaTotalUniqueUsers,
    embeddedFieldType: typeof data.embeddedUpdateTotalUniqueUsers,
    otaFieldType: typeof data.otaTotalUniqueUsers,
    embeddedFieldPresent: Object.prototype.hasOwnProperty.call(data, "embeddedUpdateTotalUniqueUsers"),
    otaFieldPresent: Object.prototype.hasOwnProperty.call(data, "otaTotalUniqueUsers"),
    failedInstallRaw: failed || null,
    seriesLength: labels.length,
    firstLabel: labels[0] || null,
    lastLabel: labels[labels.length - 1] || null,
    firstNonZeroDate: firstNonZeroIdx >= 0 ? labels[firstNonZeroIdx] : null,
    firstNonZeroValue: firstNonZeroIdx >= 0 ? values[firstNonZeroIdx] : null,
    seriesSample: labels.slice(0, 5).map((label, i) => ({ date: label, count: values[i] })),
    seriesTail: labels.slice(-5).map((label, i) => ({
      date: label,
      count: values[values.length - 5 + i],
    })),
  };
}

const discovered = discoverChannelRuntimePairs(projectId);
const insightsDiag = [];
for (const pair of discovered.pairs || []) {
  const fetched = fetchChannelInsights(projectId, {
    channel: pair.channel,
    runtimeVersion: pair.runtimeVersion,
    days: 30,
  });
  insightsDiag.push({
    channel: pair.channel,
    runtimeVersion: pair.runtimeVersion,
    source: pair.source,
    responded: fetched.ok,
    error: fetched.error || null,
    fields: fetched.ok ? pickInsightsFields(fetched.data) : null,
  });
}

const observe = fetchObserveMetricsSummary(projectId);
const observeTopKeys = observe.ok && observe.data ? Object.keys(observe.data) : [];
const observeSample = observe.ok
  ? {
      topLevelKeys: observeTopKeys,
      timespan: observe.data.timespan || observe.data.period || observe.data.timeRange || null,
      versionsCount: observe.data.versions?.length ?? 0,
    }
  : { error: observe.error };

const out = { insightsDiag, observeSample };
writeFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "probe-expo-raw-fields.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
