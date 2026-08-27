export const EXPO_UNAVAILABLE = "Não disponível";

/**
 * Lê número da resposta Expo preservando unavailable vs zero real.
 * @param {unknown} raw
 * @param {{ fieldPresent?: boolean }} options
 */
export function readExpoMetric(raw, { fieldPresent = true } = {}) {
  if (!fieldPresent) {
    return { status: "unavailable", value: null };
  }
  if (raw === undefined) {
    return { status: "unavailable", value: null };
  }
  if (raw === null) {
    return { status: "unavailable", value: null };
  }
  const num = Number(raw);
  if (Number.isNaN(num)) {
    return { status: "unavailable", value: null };
  }
  return { status: "available", value: num };
}

/**
 * Pontos da série temporal: null da API = sem histórico naquele dia.
 */
export function readSeriesPoint(raw) {
  if (raw == null) {
    return { pointStatus: "no_history", count: null };
  }
  const num = Number(raw);
  if (Number.isNaN(num)) {
    return { pointStatus: "unavailable", count: null };
  }
  return { pointStatus: "available", count: num };
}

/**
 * Recorta série a partir do primeiro dia com unique users > 0.
 */
export function trimUsageSeriesToFirstData(dailySeries = []) {
  const firstIdx = dailySeries.findIndex(
    (item) => item.pointStatus === "available" && Number(item.count) > 0,
  );
  if (firstIdx < 0) {
    return { series: [], seriesStatus: "no_history", telemetryStart: null };
  }
  const series = dailySeries.slice(firstIdx).filter((item) => item.pointStatus === "available");
  return {
    series,
    seriesStatus: series.length ? "available" : "no_history",
    telemetryStart: dailySeries[firstIdx]?.date || null,
  };
}

export function formatTelemetryStart(isoDate) {
  if (!isoDate) return null;
  const d = new Date(String(isoDate).slice(0, 10));
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function metricToKpi({ key, label, metric, note, kind = "number" }) {
  if (metric.status === "unavailable") {
    return {
      key,
      label,
      status: "unavailable",
      kind: "text",
      value: EXPO_UNAVAILABLE,
      note,
    };
  }
  if (metric.status === "no_history") {
    return {
      key,
      label,
      status: "unavailable",
      kind: "text",
      value: EXPO_UNAVAILABLE,
      note: note || "Sem histórico de telemetria no período consultado.",
    };
  }
  return {
    key,
    label,
    status: "ok",
    kind,
    value: metric.value,
    note,
  };
}

export function channelHasUsage(row) {
  if (!row?.ok) return false;
  return (row.embeddedUniqueUsers ?? 0) > 0 || (row.otaUniqueUsers ?? 0) > 0;
}
