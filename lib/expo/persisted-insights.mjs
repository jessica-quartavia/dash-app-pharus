/**
 * Leitura futura de snapshots Observe persistidos no Supabase.
 * Nesta etapa não conecta ao banco e não grava nada.
 *
 * Tabelas propostas (ainda não criadas):
 * - expo_app_versions
 * - expo_performance_metrics
 *
 * Deduplicação prevista (snapshot, não upsert contínuo):
 * - cada coleta gera snapshot_id = collected_at truncado na hora (YYYY-MM-DDTHH)
 * - versions: unique (snapshot_id, platform, app_version)
 * - performance: unique (snapshot_id, platform, app_version, metric_name)
 * - a Vercel lê apenas o snapshot mais recente
 * - reexecução na mesma hora substitui o snapshot (upsert pelas chaves acima)
 *
 * Frequência recomendada:
 * - versions: a cada 6 horas (o resumo Observe não tem intervalo temporal)
 * - performance: a cada 1–6 horas (mesmo comando CLI alimenta os dois blocos)
 */
export const PERSISTED_INSIGHTS_STATUS = "not_connected";

export async function getPersistedVersions() {
  return {
    available: false,
    status: PERSISTED_INSIGHTS_STATUS,
    snapshotId: null,
    collectedAt: null,
    rows: [],
  };
}

export async function getPersistedPerformance() {
  return {
    available: false,
    status: PERSISTED_INSIGHTS_STATUS,
    snapshotId: null,
    collectedAt: null,
    rows: [],
    observe: null,
  };
}

export async function readPersistedInsights() {
  const [versions, performance] = await Promise.all([getPersistedVersions(), getPersistedPerformance()]);
  return { versions, performance };
}

export function presentPersistedVersionRows(rows = []) {
  return rows.map((row, index) => ({
    id: `${row.platform || "unknown"}-${row.app_version || "unknown"}-${index}`,
    platform: row.platform,
    version: row.app_version,
    events: row.event_count,
    percent: row.percentage,
  }));
}

export function presentPersistedObserve(rows = [], observe = null) {
  if (observe?.configured) return observe;
  const performanceRows = rows.map((row, index) => ({
    id: `${row.platform || "unknown"}-${row.app_version || "unknown"}-${index}`,
    platform: row.platform,
    version: row.app_version,
    metricName: row.metric_name,
    metricLabel: row.metric_label || row.metric_name,
    eventCount: row.event_count ?? null,
    medianSeconds: row.metric_value ?? null,
    p90Seconds: row.metric_value_p90 ?? null,
  }));
  return {
    configured: performanceRows.length > 0,
    performanceRows,
    totalEvents: rows.reduce((acc, row) => acc + (Number(row.event_count) || 0), 0),
    respectsDateRange: false,
    periodNote: "Snapshot persistido de eas observe:metrics-summary. Não respeita o filtro de período do dashboard.",
    metricKind: "events",
  };
}

export function overlayPersistedInsights({
  versionRows = [],
  observe = null,
  capabilities = {},
  persisted = { versions: { available: false }, performance: { available: false } },
} = {}) {
  const next = {
    versionRows,
    observe,
    capabilities: {
      ...capabilities,
      availableInServerless: { ...(capabilities.availableInServerless || {}) },
    },
    versionRowsSource: versionRows.length ? "eas_observe" : null,
    observeSource: observe?.configured ? "eas_observe" : null,
  };

  if ((!next.versionRows || next.versionRows.length === 0) && persisted.versions?.available) {
    next.versionRows = presentPersistedVersionRows(persisted.versions.rows || []);
    next.capabilities.versions = true;
    next.capabilities.availableInServerless.versions = true;
    next.versionRowsSource = "persisted_observe";
  }

  if (!next.observe?.configured && persisted.performance?.available) {
    next.observe = presentPersistedObserve(persisted.performance.rows || [], persisted.performance.observe);
    next.capabilities.observe = true;
    next.capabilities.availableInServerless.observe = true;
    next.observeSource = "persisted_observe";
  }

  return next;
}
