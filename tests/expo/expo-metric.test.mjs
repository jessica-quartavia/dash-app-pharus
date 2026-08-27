import assert from "node:assert/strict";
import test from "node:test";
import {
  readExpoMetric,
  readSeriesPoint,
  trimUsageSeriesToFirstData,
} from "../../lib/expo/expo-metric.mjs";

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
