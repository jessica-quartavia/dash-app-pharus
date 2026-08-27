import { createEasWorkspace, runEas } from "./eas-cli.mjs";

export function fetchObserveMetricsSummary(projectId) {
  const cwd = createEasWorkspace(projectId);
  const result = runEas(["observe:metrics-summary", "--json", "--non-interactive"], {
    cwd,
    expectJson: true,
    timeoutMs: 120_000,
  });
  if (!result.ok) return result;
  return { ok: true, data: result.data };
}

export function fetchObserveEvents(projectId) {
  const cwd = createEasWorkspace(projectId);
  const result = runEas(["observe:events", "--json", "--non-interactive"], {
    cwd,
    expectJson: true,
    timeoutMs: 120_000,
  });
  return result;
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

  return {
    versionRows,
    platformSplit,
    totalEvents,
    configured: versionRows.length > 0,
    periodNote:
      "Resumo acumulado retornado por eas observe:metrics-summary. A API não expõe intervalo temporal nem respeita filtros de período do dashboard.",
    respectsDateRange: false,
    metricKind: "events",
  };
}
