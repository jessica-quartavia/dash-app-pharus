import { createEasWorkspace, listBuilds, listChannels, runEas, viewChannel } from "./eas-cli.mjs";
import { readExpoMetric, readSeriesPoint, trimUsageSeriesToFirstData } from "./expo-metric.mjs";

function runtimesFromChannelView(payload) {
  const page = payload?.currentPage || payload;
  const branches = page?.updateBranches || [];
  const runtimes = new Set();
  for (const branch of branches) {
    for (const group of branch.updateGroups || []) {
      const items = Array.isArray(group) ? group : [group];
      for (const item of items) {
        const version = item?.runtime?.version;
        if (version) runtimes.add(String(version));
      }
    }
  }
  return [...runtimes];
}

export async function discoverChannelRuntimePairs(projectId) {
  const channelsResult = await listChannels(projectId, 25);
  if (!channelsResult.ok) return channelsResult;

  const pairs = [];

  for (const channel of channelsResult.rows || []) {
    const view = await viewChannel(projectId, channel.name);
    const runtimes = view.ok ? runtimesFromChannelView(view.data) : [];
    if (runtimes.length) {
      for (const runtimeVersion of runtimes) {
        pairs.push({ channel: channel.name, runtimeVersion, source: "channel:view" });
      }
    }
  }

  const hasProduction = pairs.some((item) => item.channel === "production");
  if (!hasProduction) {
    const buildsResult = await listBuilds(projectId, 5);
    const latest = (buildsResult.rows || []).find((row) => row.fingerprintHash);
    if (latest?.fingerprintHash) {
      pairs.push({
        channel: "production",
        runtimeVersion: latest.fingerprintHash,
        source: "build:fingerprint",
      });
    }
  }

  return { ok: true, pairs, channels: channelsResult.rows };
}

export async function fetchChannelInsights(projectId, { channel, runtimeVersion, days = 30, startDate, endDate }) {
  const cwd = createEasWorkspace(projectId);
  const args = [
    "channel:insights",
    "--channel",
    channel,
    "--runtime-version",
    runtimeVersion,
    "--json",
    "--non-interactive",
  ];
  if (startDate && endDate) {
    args.push("--start", startDate, "--end", endDate);
  } else {
    args.push("--days", String(days));
  }
  const result = await runEas(args, { cwd, expectJson: true, timeoutMs: 180_000 });
  if (!result.ok) return result;
  return { ok: true, data: result.data };
}

export function parseChannelInsights(data) {
  if (!data) return null;

  const uniqueUsersOverTime = data.uniqueUsersOverTime || {};
  const labels = uniqueUsersOverTime.labels || [];
  const datasets = uniqueUsersOverTime.datasets || [];
  const primaryDataset = datasets[0]?.data || [];

  const dailySeries = labels.slice(0, primaryDataset.length).map((label, index) => {
    const point = readSeriesPoint(primaryDataset[index]);
    return {
      date: String(label).slice(0, 10),
      count: point.count,
      pointStatus: point.pointStatus,
    };
  });

  const trimmed = trimUsageSeriesToFirstData(dailySeries);

  const failedInstallsEntry = (data.cumulativeMetricsAtLastTimestamp || []).find((item) =>
    /failed/i.test(String(item.label || item.id || "")),
  );
  const failedInstalls = readExpoMetric(failedInstallsEntry?.data, {
    fieldPresent: Boolean(failedInstallsEntry),
  });

  const embedded = readExpoMetric(data.embeddedUpdateTotalUniqueUsers, {
    fieldPresent: Object.prototype.hasOwnProperty.call(data, "embeddedUpdateTotalUniqueUsers"),
  });
  const ota = readExpoMetric(data.otaTotalUniqueUsers, {
    fieldPresent: Object.prototype.hasOwnProperty.call(data, "otaTotalUniqueUsers"),
  });

  return {
    channel: data.channel,
    runtimeVersion: data.runtimeVersion,
    daysBack: data.timespan?.daysBack ?? null,
    timespan: data.timespan || null,
    embeddedUniqueUsers: embedded,
    otaUniqueUsers: ota,
    failedInstalls,
    dailySeries,
    usageSeries: trimmed.series,
    seriesStatus: trimmed.seriesStatus,
    telemetryStart: trimmed.telemetryStart,
    mostPopularUpdates: (data.mostPopularUpdates || []).map((item) => ({
      id: item.id || item.updateId || null,
      message: item.message || null,
      users: item.users ?? item.uniqueUsers ?? null,
    })),
  };
}

export async function fetchAllChannelInsights(projectId, { days = 30, startDate, endDate } = {}) {
  const discovered = await discoverChannelRuntimePairs(projectId);
  if (!discovered.ok) return discovered;

  const results = await Promise.all((discovered.pairs || []).map(async (pair) => {
    const fetched = await fetchChannelInsights(projectId, {
      channel: pair.channel,
      runtimeVersion: pair.runtimeVersion,
      days,
      startDate,
      endDate,
    });
    if (!fetched.ok) {
      return { ...pair, ok: false, error: fetched.error };
    }
    return {
      ...pair,
      ok: true,
      raw: fetched.data,
      parsed: parseChannelInsights(fetched.data),
    };
  }));

  const production =
    results.find((item) => item.ok && item.channel === "production") ||
    results.find((item) => item.ok && item.parsed?.embeddedUniqueUsers?.value > 0) ||
    results.find((item) => item.ok);

  return {
    ok: true,
    pairs: discovered.pairs,
    results,
    primary: production?.parsed || null,
    primaryChannel: production?.channel || null,
    primaryRaw: production?.raw || null,
    worked: results.some((item) => item.ok),
  };
}

export function buildChannelDiagnostics(results = []) {
  return results.map((item) => ({
    channel: item.channel,
    runtimeVersion: item.runtimeVersion,
    source: item.source,
    responded: Boolean(item.ok),
    embeddedUsers:
      item.ok && item.parsed?.embeddedUniqueUsers?.status === "available"
        ? item.parsed.embeddedUniqueUsers.value
        : null,
    otaUsers:
      item.ok && item.parsed?.otaUniqueUsers?.status === "available" ? item.parsed.otaUniqueUsers.value : null,
    failures:
      item.ok && item.parsed?.failedInstalls?.status === "available" ? item.parsed.failedInstalls.value : null,
    embeddedStatus: item.ok ? item.parsed?.embeddedUniqueUsers?.status || "unavailable" : "unavailable",
    otaStatus: item.ok ? item.parsed?.otaUniqueUsers?.status || "unavailable" : "unavailable",
    failuresStatus: item.ok ? item.parsed?.failedInstalls?.status || "unavailable" : "unavailable",
    telemetryStart: item.parsed?.telemetryStart || null,
    seriesStatus: item.parsed?.seriesStatus || "unavailable",
    error: item.error || null,
  }));
}
