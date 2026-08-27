import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleOfficialClients, presentClientsPage } from "../../lib/app-pharus/clients-page.mjs";
import { PAGE_FILTERS } from "../../js/lib/filters/contracts.mjs";

function member(id, createdAt, extra = {}) {
  return {
    id,
    email: `${id}@email.com`,
    created_at: createdAt,
    deleted_at: null,
    raw_app_meta_data: { role: "member" },
    raw_user_meta_data: { name: extra.name || id },
    ...extra.user,
  };
}

describe("página Clientes", () => {
  it("mantém cliente oficial sem personal_info, patrimônio ou Open Finance", () => {
    const rows = assembleOfficialClients({
      users: [member("u1", "2026-08-01T12:00:00.000Z")],
      profiles: [],
      stages: [],
      wealthIds: new Set(),
      ofIds: new Set(),
      mechanismIds: new Set(),
      meetingIds: new Set(),
      formIds: new Set(),
      journeyIds: new Set(),
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "u1");
    assert.equal(rows[0].hasWealth, false);
    assert.equal(rows[0].hasOpenFinance, false);
    assert.equal(rows[0].journeyStage, "Não informado");
  });

  it("não marca Open Finance como Não quando a fonte secundária falhou", () => {
    const rows = assembleOfficialClients({
      users: [member("u1", "2026-08-01T12:00:00.000Z")],
      profiles: [],
      stages: [],
      wealthIds: new Set(),
      ofIds: new Set(),
      mechanismIds: new Set(),
      meetingIds: new Set(),
      formIds: new Set(),
      journeyIds: new Set(),
      sources: { connections: false },
    });
    assert.equal(rows[0].hasOpenFinance, null);
    assert.equal(rows[0].hasWealth, false);
  });

  it("usa o nome de personal_info quando existe", () => {
    const rows = assembleOfficialClients({
      users: [member("u1", "2026-08-01T12:00:00.000Z")],
      profiles: [{ user_id: "u1", name: "Ana Souza" }],
      stages: [{ user_id: "u1", current_stage: "Onboarding" }],
      wealthIds: new Set(["u1"]),
      ofIds: new Set(),
      mechanismIds: new Set(),
      meetingIds: new Set(),
      formIds: new Set(),
      journeyIds: new Set(["u1"]),
    });
    assert.equal(rows[0].name, "Ana Souza");
    assert.equal(rows[0].journeyStage, "Onboarding");
    assert.equal(rows[0].hasWealth, true);
  });

  it("marca mecanismos implementados pelos registros oficiais", () => {
    const rows = assembleOfficialClients({
      users: [member("u1", "2026-08-01T12:00:00.000Z")],
      profiles: [],
      stages: [],
      wealthIds: new Set(),
      ofIds: new Set(),
      mechanismIds: new Set(["u1"]),
      mechanismCounts: new Map([["u1", 5]]),
      meetingIds: new Set(),
      formIds: new Set(),
      journeyIds: new Set(),
    });
    assert.equal(rows[0].hasMechanisms, true);
    assert.equal(rows[0].mechanismsImplemented, 5);
  });

  it("Total sem período = população oficial; Novos some quando o período é todo", () => {
    const clients = assembleOfficialClients({
      users: [
        member("a", "2026-08-01T15:00:00.000-03:00"),
        member("b", "2026-05-01T15:00:00.000-03:00"),
      ],
      profiles: [],
      stages: [],
      wealthIds: new Set(),
      ofIds: new Set(),
      mechanismIds: new Set(),
      meetingIds: new Set(),
      formIds: new Set(),
      journeyIds: new Set(),
    });
    const page = presentClientsPage({ clients, clientBase: { total: 2 } }, { period: "all" });
    const total = page.kpis.find((kpi) => kpi.key === "total");
    const news = page.kpis.find((kpi) => kpi.key === "new");
    assert.equal(total.value, 2);
    assert.equal(news, undefined);
    assert.equal(page.rows.length, 2);
  });

  it("período filtra created_at e preenche Novos no período", () => {
    const clients = assembleOfficialClients({
      users: [
        member("a", "2026-08-10T15:00:00.000-03:00"),
        member("b", "2026-05-01T15:00:00.000-03:00"),
      ],
      profiles: [],
      stages: [],
      wealthIds: new Set(),
      ofIds: new Set(),
      mechanismIds: new Set(),
      meetingIds: new Set(),
      formIds: new Set(),
      journeyIds: new Set(),
    });
    const page = presentClientsPage(
      { clients, clientBase: { total: 2 } },
      { period: "custom", startDate: "2026-08-01", endDate: "2026-08-26" },
    );
    const total = page.kpis.find((kpi) => kpi.key === "total");
    const news = page.kpis.find((kpi) => kpi.key === "new");
    assert.equal(total.value, 1);
    assert.equal(news.status, "ok");
    assert.equal(news.value, 1);
    assert.equal(page.rows.length, 1);
    assert.equal(page.officialTotal, 2);
    assert.equal(page.recorteTotal, 1);
    assert.match(total.note, /No recorte: 1/);
  });

  it("mantém situação de uso pendente e calcula onboarding e inatividade operacional", () => {
    const clients = assembleOfficialClients({
      users: [
        member("a", "2026-08-01T15:00:00.000-03:00"),
        member("b", "2026-05-01T15:00:00.000-03:00"),
      ],
      profiles: [],
      stages: [],
      wealthIds: new Set(),
      ofIds: new Set(),
      mechanismIds: new Set(),
      meetingIds: new Set(),
      formIds: new Set(),
      journeyIds: new Set(),
      onboardingIds: new Set(["a"]),
      personalDataIds: new Set(["a", "b"]),
      lastOperationalActivity: new Map([["a", "2026-08-20"], ["b", "2026-01-01"]]),
    });
    const page = presentClientsPage(
      {
        clients,
        clientBase: { total: 2 },
        enrichment: {
          user_progress: "ok",
          form_submissions: "ok",
          scheduled_meetings: "ok",
          user_mechanisms: "ok",
        },
      },
      { period: "all" },
    );
    const active = page.kpis.find((item) => item.key === "active");
    const onboarding = page.kpis.find((item) => item.key === "onboarding");
    const personal = page.kpis.find((item) => item.key === "personal_data");
    const inactive = page.kpis.find((item) => item.key === "inactive");
    assert.equal(active.status, "pending");
    assert.equal(onboarding.status, "ok");
    assert.equal(onboarding.value, 1);
    assert.equal(personal.value, 2);
    assert.equal(inactive.status, "ok");
    assert.equal(inactive.value, 1);
    assert.equal(clients[0].onboardingComplete, true);
    assert.equal(clients[1].lastOperationalActivityAt, "2026-01-01");
  });

  it("filtros da página Clientes não usam status mock nem DE/ATÉ", () => {
    const fields = PAGE_FILTERS().clientes;
    const keys = fields.map((field) => field.key);
    assert.equal(keys.includes("period"), true);
    assert.equal(keys.includes("segment"), true);
    assert.equal(keys.includes("status"), false);
    assert.equal(keys.includes("advisor"), false);
    assert.equal(fields.some((field) => field.kind === "period"), true);
    assert.equal(
      fields.some((field) => field.options?.some((option) => option.value === "Onboarding")),
      true,
    );
  });
});
