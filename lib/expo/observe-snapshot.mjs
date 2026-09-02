import { parseObserveMetricsSummary } from "./observe.mjs";

/**
 * Normaliza o JSON de `eas observe:metrics-summary` para o formato persistível.
 * Tabelas propostas (ainda não criadas):
 * - expo_app_versions: id, collected_at, snapshot_id, app_version, platform,
 *   event_count, percentage, source, build_numbers, update_ids, raw_metadata
 * - expo_performance_metrics: id, collected_at, snapshot_id, metric_name,
 *   metric_label, metric_value (mediana), metric_value_p90, event_count,
 *   platform, app_version, runtime_version, build_number, source, raw_metadata
 *
 * Observe summary não retorna crashes, launches globais, cold launch como
 * evento separado de métrica, nem runtime_version. Esses campos ficam nulos
 * quando ausentes no JSON.
 */

export const OBSERVE_SOURCE = "eas_observe_metrics_summary";
export const OBSERVE_COMMAND = "eas observe:metrics-summary --json --non-interactive";

export function snapshotIdFrom(collectedAt) {
  return String(collectedAt || "").slice(0, 13);
}

export function versionDedupKey(row) {
  return [row.snapshot_id, row.platform, row.app_version].join("|");
}

export function performanceDedupKey(row) {
  return [row.snapshot_id, row.platform, row.app_version, row.metric_name].join("|");
}

function percentOf(part, total) {
  if (!total) return null;
  return Math.round((part / total) * 1000) / 10;
}

export function buildObserveSnapshot(rawSummary, { collectedAt = new Date().toISOString() } = {}) {
  const parsed = parseObserveMetricsSummary(rawSummary || {});
  const snapshotId = snapshotIdFrom(collectedAt);
  const byVersion = new Map(parsed.versionRows.map((row) => [row.id, row]));

  const versions = parsed.versionRows.map((row) => ({
    collected_at: collectedAt,
    snapshot_id: snapshotId,
    app_version: row.version || null,
    platform: row.platform || null,
    event_count: row.eventCount ?? 0,
    percentage: percentOf(row.eventCount, parsed.totalEvents),
    source: OBSERVE_SOURCE,
    build_numbers: row.buildNumbers || [],
    update_ids: row.updateIds || [],
    raw_metadata: {
      metrics: row.metrics || {},
    },
  }));

  const performance = parsed.performanceRows.map((row) => {
    const parent =
      byVersion.get(row.id.replace(/-\d+$/, "")) ||
      parsed.versionRows.find((item) => item.platform === row.platform && item.version === row.version);
    return {
      collected_at: collectedAt,
      snapshot_id: snapshotId,
      metric_name: row.metricName,
      metric_label: row.metricLabel,
      metric_value: row.medianSeconds,
      metric_value_p90: row.p90Seconds,
      event_count: row.eventCount,
      platform: row.platform || null,
      app_version: row.version || null,
      runtime_version: null,
      build_number: parent?.buildNumbers?.[0] || null,
      source: OBSERVE_SOURCE,
      raw_metadata: {
        median: row.medianSeconds,
        p90: row.p90Seconds,
        eventCount: row.eventCount,
      },
    };
  });

  return {
    snapshot_id: snapshotId,
    collected_at: collectedAt,
    source: OBSERVE_SOURCE,
    command: OBSERVE_COMMAND,
    respectsDateRange: false,
    recommendedFrequency: {
      versions: "every 6 hours",
      performance: "every 1 to 6 hours",
    },
    dedup: {
      versions: "snapshot_id + platform + app_version",
      performance: "snapshot_id + platform + app_version + metric_name",
      strategy: "upsert latest snapshot; dashboard reads max(snapshot_id)",
    },
    totals: {
      versions: versions.length,
      performance: performance.length,
      events: parsed.totalEvents,
    },
    versions,
    performance,
    observe: parsed,
  };
}

export function maskObserveSample(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => maskObserveSample(item));
  if (typeof value !== "object") {
    const text = String(value);
    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(text) || text.length > 36) {
      return `${text.slice(0, 4)}…${text.slice(-4)}`;
    }
    return value;
  }
  const next = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "update_ids" || key === "updateIds") {
      next[key] = Array.isArray(item) ? item.slice(0, 2).map((id) => maskObserveSample(id)) : maskObserveSample(item);
      continue;
    }
    if (key === "raw_metadata") {
      next[key] = { keys: Object.keys(item || {}) };
      continue;
    }
    next[key] = maskObserveSample(item);
  }
  return next;
}
