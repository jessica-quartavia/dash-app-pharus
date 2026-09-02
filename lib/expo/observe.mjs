import { createEasWorkspace, runEas } from "./eas-cli.mjs";

export async function fetchObserveMetricsSummary(projectId) {
  const cwd = createEasWorkspace(projectId);
  const result = await runEas(["observe:metrics-summary", "--json", "--non-interactive"], {
    cwd,
    expectJson: true,
    timeoutMs: 120_000,
  });
  if (!result.ok) return result;
  return { ok: true, data: result.data };
}

export async function fetchObserveEvents(projectId) {
  const cwd = createEasWorkspace(projectId);
  return runEas(["observe:events", "--json", "--non-interactive"], {
    cwd,
    expectJson: true,
    timeoutMs: 120_000,
  });
}

export function parseObserveMetricsSummary(data) {
  const versions = data?.versions || [];
  const versionRows = versions.map((row, index) => {
    const metrics = row.metrics || {};
    const eventCount = Object.values(metrics).reduce((acc, metric) => acc + (metric.eventCount || 0), 0);
    return {
      id: `${row.platform}-${row.appVersion}-${index}`,
      platform: row.platform,
      version: row.appVersion,
      buildNumbers: row.buildNumbers || [],
      updateIds: row.updateIds || [],
      eventCount,
      metrics,
    };
  });

  const platformTotals = {};
  for (const row of versionRows) {
    const key = row.platform || "UNKNOWN";
    platformTotals[key] = (platformTotals[key] || 0) + row.eventCount;
  }
  const platformTotalEvents = Object.values(platformTotals).reduce((a, b) => a + b, 0) || 0;
  const platformSplit = Object.entries(platformTotals).map(([label, count]) => ({
    label,
    count,
    percent: platformTotalEvents ? Math.round((count / platformTotalEvents) * 1000) / 10 : 0,
  }));

  const totalEvents = versionRows.reduce((acc, row) => acc + row.eventCount, 0);
  const metricLabels = {
    "expo.app_startup.bundle_load_time": "Carregamento do bundle",
    "expo.app_startup.cold_launch_time": "Cold launch",
    "expo.app_startup.warm_launch_time": "Warm launch",
    "expo.app_startup.tti": "Tempo até interatividade",
    "expo.app_startup.ttr": "Tempo até renderização",
  };
  const performanceRows = versionRows.flatMap((row) =>
    Object.entries(row.metrics || {}).map(([metricName, metric], index) => ({
      id: `${row.id}-${index}`,
      platform: row.platform,
      version: row.version,
      metricName,
      metricLabel: metricLabels[metricName] || metricName,
      eventCount: metric?.eventCount ?? null,
      medianSeconds: metric?.median ?? null,
      p90Seconds: metric?.p90 ?? null,
    })),
  );

  return {
    versionRows,
    performanceRows,
    platformSplit,
    totalEvents,
    configured: versionRows.length > 0,
    periodNote:
      "Resumo acumulado retornado por eas observe:metrics-summary. A API não expõe intervalo temporal nem respeita filtros de período do dashboard.",
    respectsDateRange: false,
    metricKind: "events",
  };
}
