import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleOfficialClients, presentClientsPage } from "../../lib/app-pharus/clients-page.mjs";
import { filterClients } from "../../js/lib/filters/apply.mjs";

function member(id, createdAt, extra = {}) {
  return {
    id,
    email: `${id}@email.com`,
    created_at: createdAt,
    deleted_at: null,
    raw_app_meta_data: { role: "member" },
    raw_user_meta_data: { name: extra.name || id },
  };
}

function basePayload(users, sets = {}) {
  return assembleOfficialClients({
    users,
    profiles: [],
    stages: sets.stages || [],
    wealthIds: sets.wealthIds || new Set(),
    ofIds: sets.ofIds || new Set(),
    mechanismIds: sets.mechanismIds || new Set(),
    meetingIds: new Set(),
    formIds: new Set(),
    journeyIds: new Set(),
    engineMap: sets.engineMap || new Map(),
    sources: { user_engines: true, ...(sets.sources || {}) },
  });
}

describe("filtros Clientes — recorte consistente", () => {
  const clients = basePayload(
    [
      member("a", "2026-08-10T12:00:00.000Z", { name: "Ana Alpha" }),
      member("b", "2026-05-01T12:00:00.000Z", { name: "Bruno Beta" }),
      member("c", "2026-06-01T12:00:00.000Z", { name: "Carla Gamma" }),
    ],
    {
      wealthIds: new Set(["a", "c"]),
      ofIds: new Set(["a"]),
      mechanismIds: new Set(["b"]),
      stages: [
        { user_id: "a", current_stage: "Onboarding" },
        { user_id: "b", current_stage: "Mecanismos" },
      ],
      engineMap: new Map([
        ["a", { income: 120_000, reserve: null, contribution: null }],
        ["b", { income: 55_000, reserve: null, contribution: null }],
        ["c", { income: null, reserve: null, contribution: null }],
      ]),
    },
  );

  it("busca reduz KPIs, gráfico e tabela", () => {
    const page = presentClientsPage({ clients, clientBase: { total: 3 } }, { period: "all", search: "ana" });
    assert.equal(page.rows.length, 1);
    assert.equal(page.kpis.find((kpi) => kpi.key === "total").value, 1);
    assert.equal(page.segmentChart.reduce((sum, item) => sum + item.count, 0), 1);
  });

  it("Open Finance Sim retorna somente clientes com OF válido", () => {
    const rows = filterClients(clients, { period: "all", openFinance: "yes" });
    assert.deepEqual(rows.map((row) => row.id), ["a"]);
  });

  it("Open Finance Não exclui quem tem OF", () => {
    const rows = filterClients(clients, { period: "all", openFinance: "no" });
    assert.equal(rows.every((row) => !row.hasOpenFinance), true);
    assert.equal(rows.length, 2);
  });

  it("mecanismos e patrimônio filtram corretamente", () => {
    assert.equal(filterClients(clients, { period: "all", hasMechanisms: "yes" }).length, 1);
    assert.equal(filterClients(clients, { period: "all", hasMechanisms: "no" }).length, 2);
    assert.equal(filterClients(clients, { period: "all", hasWealth: "yes" }).length, 2);
    assert.equal(filterClients(clients, { period: "all", hasWealth: "no" }).length, 1);
  });

  it("jornada e segmento filtram pelo valor exibido", () => {
    assert.equal(filterClients(clients, { period: "all", journeyStage: "Onboarding" }).length, 1);
    assert.equal(filterClients(clients, { period: "all", segment: "Tier 1" }).length, 1);
    assert.equal(filterClients(clients, { period: "all", segment: "Tier 2" }).length, 1);
    assert.equal(filterClients(clients, { period: "all", segment: "Dados insuficientes" }).length, 1);
  });

  it("combinação Tier 1 + Open Finance + patrimônio", () => {
    const rows = filterClients(clients, {
      period: "all",
      segment: "Tier 1",
      openFinance: "yes",
      hasWealth: "yes",
    });
    assert.deepEqual(rows.map((row) => row.id), ["a"]);
    const page = presentClientsPage({ clients, clientBase: { total: 3 } }, {
      period: "all",
      segment: "Tier 1",
      openFinance: "yes",
      hasWealth: "yes",
    });
    assert.equal(page.rows.length, 1);
    assert.equal(page.kpis.find((kpi) => kpi.key === "total").value, 1);
  });
});
