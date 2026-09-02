import { fetchUpdateInsights, listUpdateGroups } from "./eas-cli.mjs";
import { readExpoMetric } from "./expo-metric.mjs";

export function normalizeUpdateGroups(data, limit = 5) {
  const rows = Array.isArray(data) ? data : data?.currentPage || data?.items || [];
  const seen = new Set();
  return rows.filter((row) => {
    const id = String(row?.group || row?.groupId || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, limit).map((row) => ({
    groupId: String(row.group || row.groupId),
    branch: typeof row.branch === "string" ? row.branch : row.branch?.name || null,
    runtimeVersion: row.runtimeVersion || null,
    platforms: row.platforms || null,
  }));
}

export function parseUpdateInsights(group, data) {
  return (data?.platforms || []).map((row, index) => {
    const totals = row.totals || {};
    const payload = row.payload || {};
    return {
      id: `${group.groupId}-${row.platform || index}`,
      groupId: group.groupId,
      branch: group.branch,
      runtimeVersion: group.runtimeVersion,
      platform: row.platform || null,
      uniqueUsers: readExpoMetric(totals.uniqueUsers, { fieldPresent: Object.hasOwn(totals, "uniqueUsers") }),
      installs: readExpoMetric(totals.installs, { fieldPresent: Object.hasOwn(totals, "installs") }),
      failedInstalls: readExpoMetric(totals.failedInstalls, { fieldPresent: Object.hasOwn(totals, "failedInstalls") }),
      crashRate: readExpoMetric(totals.crashRatePercent, { fieldPresent: Object.hasOwn(totals, "crashRatePercent") }),
      launches: readExpoMetric(payload.launchAssetCount, { fieldPresent: Object.hasOwn(payload, "launchAssetCount") }),
      timespan: data.timespan || null,
    };
  });
}

export async function fetchRecentUpdateInsights(projectId, { days = 30, startDate, endDate, limit = 5 } = {}) {
  const listed = await listUpdateGroups(projectId, Math.max(limit, 10));
  if (!listed.ok) return { ok: false, rows: [], error: listed.error };
  const groups = normalizeUpdateGroups(listed.data, limit);
  const fetched = await Promise.all(groups.map(async (group) => {
    const result = await fetchUpdateInsights(projectId, group.groupId, { days, startDate, endDate });
    if (!result.ok) return { error: { groupId: group.groupId, error: result.error }, rows: [] };
    return { error: null, rows: parseUpdateInsights(group, result.data) };
  }));
  const rows = fetched.flatMap((item) => item.rows);
  const errors = fetched.map((item) => item.error).filter(Boolean);
  const launchRows = rows.filter((row) => row.launches.status === "available");
  const launches = launchRows.length
    ? { status: "available", value: launchRows.reduce((sum, row) => sum + row.launches.value, 0) }
    : { status: "unavailable", value: null };
  const latestCrashRate = rows.find((row) => row.crashRate.status === "available") || null;
  return {
    ok: rows.length > 0,
    groups,
    rows,
    errors,
    launches,
    latestCrashRate: latestCrashRate?.crashRate || { status: "unavailable", value: null },
    latestCrashRateScope: latestCrashRate ? { groupId: latestCrashRate.groupId, platform: latestCrashRate.platform } : null,
  };
}
