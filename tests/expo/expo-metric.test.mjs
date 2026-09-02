import assert from "node:assert/strict";
import test from "node:test";
import {
  readExpoMetric,
  readSeriesPoint,
  trimUsageSeriesToFirstData,
} from "../../lib/expo/expo-metric.mjs";
import { parseObserveMetricsSummary } from "../../lib/expo/observe.mjs";
import { normalizeUpdateGroups, parseUpdateInsights } from "../../lib/expo/update-insights.mjs";
import { usageLineChart } from "../../js/components/charts.mjs";

test("readExpoMetric distingue zero real de campo ausente", () => {
  assert.deepEqual(readExpoMetric(0, { fieldPresent: true }), { status: "available", value: 0 });
  assert.deepEqual(readExpoMetric(null, { fieldPresent: true }), { status: "unavailable", value: null });
  assert.deepEqual(readExpoMetric(undefined, { fieldPresent: false }), { status: "unavailable", value: null });
});

test("readSeriesPoint trata null como sem histórico", () => {
  assert.deepEqual(readSeriesPoint(null), { pointStatus: "no_history", count: null });
  assert.deepEqual(readSeriesPoint(0), { pointStatus: "available", count: 0 });
  assert.deepEqual(readSeriesPoint(6), { pointStatus: "available", count: 6 });
});

test("trimUsageSeriesToFirstData inicia na primeira data com uso", () => {
  const daily = [
    { date: "2026-08-13", count: null, pointStatus: "no_history" },
    { date: "2026-08-19", count: 6, pointStatus: "available" },
    { date: "2026-08-20", count: 7, pointStatus: "available" },
  ];
  const trimmed = trimUsageSeriesToFirstData(daily);
  assert.equal(trimmed.telemetryStart, "2026-08-19");
  assert.equal(trimmed.series.length, 2);
  assert.equal(trimmed.series[0].count, 6);
});

test("trimUsageSeriesToFirstData sem uso retorna no_history", () => {
  const daily = [
    { date: "2026-08-13", count: 0, pointStatus: "available" },
    { date: "2026-08-14", count: 0, pointStatus: "available" },
  ];
  const trimmed = trimUsageSeriesToFirstData(daily);
  assert.equal(trimmed.seriesStatus, "no_history");
  assert.equal(trimmed.series.length, 0);
});

test("Observe mantém eventos separados de usuários e expõe performance por versão", () => {
  const parsed = parseObserveMetricsSummary({
    versions: [{
      platform: "ANDROID",
      appVersion: "1.2.1",
      buildNumbers: ["16"],
      metrics: {
        "expo.app_startup.cold_launch_time": { eventCount: 12, median: 0.8, p90: 1.4 },
      },
    }],
  });
  assert.equal(parsed.totalEvents, 12);
  assert.deepEqual(parsed.platformSplit, [{ label: "ANDROID", count: 12, percent: 100 }]);
  assert.equal(parsed.performanceRows[0].metricLabel, "Cold launch");
  assert.equal(parsed.performanceRows[0].medianSeconds, 0.8);
  assert.equal(parsed.metricKind, "events");
});

test("Update Insights preserva zeros reais e o escopo do grupo", () => {
  const groups = normalizeUpdateGroups({ currentPage: [
    { group: "group-1", branch: "production", runtimeVersion: "runtime-1" },
    { group: "group-1", branch: "production", runtimeVersion: "runtime-1" },
  ] });
  assert.equal(groups.length, 1);
  const rows = parseUpdateInsights(groups[0], {
    timespan: { daysBack: 30 },
    platforms: [{
      platform: "ios",
      totals: { uniqueUsers: 0, installs: 0, failedInstalls: 0, crashRatePercent: 0 },
      payload: { launchAssetCount: 0 },
    }],
  });
  assert.equal(rows[0].uniqueUsers.status, "available");
  assert.equal(rows[0].uniqueUsers.value, 0);
  assert.equal(rows[0].launches.value, 0);
  assert.equal(rows[0].crashRate.value, 0);
});

test("gráfico de uso é linha, usa datas pt-BR e destaca o último ponto sem mudar a cor", () => {
  const markup = usageLineChart([
    { date: "2026-08-31", count: 4 },
    { date: "2026-09-01", count: 8 },
  ]);
  assert.match(markup, /class="usage-line-path"/);
  assert.match(markup, /31 de agosto de 2026/);
  assert.match(markup, /4 usuários únicos/);
  assert.match(markup, />1 set</);
  assert.doesNotMatch(markup, /usage-line-point is-latest/);
  assert.doesNotMatch(markup, /acq-col-bar/);
});
