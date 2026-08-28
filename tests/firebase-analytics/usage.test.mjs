import assert from "node:assert/strict";
import test from "node:test";
import { GA4_METRICS, normalizeGa4Range, queryGa4Usage } from "../../lib/firebase-analytics/usage.mjs";

const dimensions = ["date", "platform", "appVersion", "eventName", "signedInWithUserId"].map((apiName) => ({ apiName, uiName: apiName }));
const metrics = GA4_METRICS.map((apiName) => ({ apiName, uiName: apiName }));

function fakeClient({ empty = false, failMetadata = null } = {}) {
  const requests = [];
  return {
    requests,
    async getMetadata() {
      if (failMetadata) throw failMetadata;
      return [{ dimensions, metrics }];
    },
    async runReport(request) {
      requests.push(request);
      const names = (request.dimensions || []).map((item) => item.name);
      if (!names.length) {
        return [{
          metricHeaders: request.metrics.map((item) => ({ name: item.name })),
          rows: empty ? [] : [{ metricValues: request.metrics.map((item, index) => ({ value: String(index + 1) })) }],
        }];
      }
      if (names[0] === "date") return [{ rows: empty ? [] : [{ dimensionValues: [{ value: "20260820" }], metricValues: [{ value: "8" }] }] }];
      if (names[0] === "platform") return [{ rows: empty ? [] : [
        { dimensionValues: [{ value: "Android" }], metricValues: [{ value: "6" }] },
        { dimensionValues: [{ value: "iOS" }], metricValues: [{ value: "2" }] },
      ] }];
      if (names[0] === "appVersion") return [{ rows: empty ? [] : [{ dimensionValues: [{ value: "1.4.0" }, { value: "Android" }], metricValues: [{ value: "6" }] }] }];
      return [{ rows: empty ? [] : [{ dimensionValues: [{ value: "open_finance_connected" }], metricValues: [{ value: "12" }] }] }];
    },
  };
}

const config = { ok: true, propertyId: "547012679", authMode: "file", clientOptions: {} };

test("resposta vazia não inventa zero nem datas", async () => {
  const result = await queryGa4Usage({ startDate: "2026-08-01", endDate: "2026-08-20" }, { config, client: fakeClient({ empty: true }) });
  assert.equal(result.available, true);
  assert.deepEqual(result.kpis, []);
  assert.deepEqual(result.usageSeries, []);
  assert.deepEqual(result.platformSplit, []);
});

test("métricas reais, período, plataforma, versão e eventos são apresentados", async () => {
  const client = fakeClient();
  const result = await queryGa4Usage({ startDate: "2026-08-01", endDate: "2026-08-20" }, { config, client });
  assert.equal(result.integration.authenticated, true);
  assert.equal(result.integration.propertyResolved, true);
  assert.equal(result.availability.metrics.activeUsers, true);
  assert.ok(result.kpis.some((item) => item.key === "active7DayUsers"));
  assert.deepEqual(result.usageSeries, [{ date: "2026-08-20", count: 8 }]);
  assert.equal(result.platformSplit[0].label, "Android");
  assert.equal(result.platformSplit[0].percent, 75);
  assert.equal(result.versionRows[0].activeUsers, 6);
  assert.equal(result.events[0].name, "open_finance_connected");
  assert.ok(client.requests.every((request) => request.dateRanges[0].startDate === "2026-08-01"));
  assert.ok(client.requests.every((request) => request.dateRanges[0].endDate === "2026-08-20"));
  assert.equal(result.retention.available, false);
  assert.equal(result.userId.supabaseMappingConfirmed, false);
});

test("erro da API retorna estado controlado sem segredo", async () => {
  const client = fakeClient({ failMetadata: new Error("Bearer abcdefghijklmnopqrstuvwxyz") });
  const result = await queryGa4Usage({}, { config, client });
  assert.equal(result.available, false);
  assert.doesNotMatch(result.userMessage, /abcdefghijklmnopqrstuvwxyz/);
});

test("normalizeGa4Range valida período invertido", () => {
  assert.throws(() => normalizeGa4Range({ startDate: "2026-08-20", endDate: "2026-08-01" }), /Período inválido/);
});
