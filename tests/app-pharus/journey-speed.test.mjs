import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { isOfficialPharusClient } from "../../lib/app-pharus/clients.mjs";
import {
  buildJourneySpeedSource,
  durationDays,
  firstCompletedMeetingsByStage,
  hasPlatformAccess,
  presentJourneySpeed,
  resolveMeetingStage,
  roundFriendlyDays,
} from "../../lib/app-pharus/journey-speed.mjs";
import { median } from "../../js/utils/format.mjs";
import { PAGE_FILTERS } from "../../js/lib/filters/contracts.mjs";
import { formatKpiValue } from "../../js/lib/kpi-value.mjs";
import { speedHBars, stackedShareBar } from "../../js/components/charts.mjs";
import { renderJourneySpeedSection } from "../../js/components/journey-speed-section.mjs";

const catalog = [
  { id: "m-rota", meeting_title: "Rota Patrimonial", meeting_slug: "wealth-route" },
  { id: "m-gears", meeting_title: "Ativação das Engrenagens", meeting_slug: "gears-activation" },
  { id: "m-central", meeting_title: "Liberação da Central de Inteligência", meeting_slug: "intelligence-center-release" },
  { id: "m-council", meeting_title: "Conselho Patrimonial", meeting_slug: "checkpoint" },
  { id: "m-special", meeting_title: "Especial", meeting_slug: "special" },
];

function meeting(overrides = {}) {
  return {
    id: "s1",
    user_id: "u1",
    meeting_id: "m-rota",
    status: "completed",
    start_time: "2026-02-01T12:00:00.000Z",
    end_time: "2026-02-01T13:00:00.000Z",
    ...overrides,
  };
}

function user(overrides = {}) {
  return {
    id: "u1",
    created_at: "2026-01-01T12:00:00.000Z",
    last_sign_in_at: "2026-01-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("tipos reais de reunião", () => {
  it("reusa títulos e slugs do catálogo core.meetings", () => {
    assert.equal(resolveMeetingStage(catalog[0])?.key, "rota_patrimonial");
    assert.equal(resolveMeetingStage(catalog[1])?.key, "ativacao_engrenagens");
    assert.equal(resolveMeetingStage(catalog[2])?.key, "central_inteligencia");
    assert.equal(resolveMeetingStage(catalog[3]), null);
    assert.equal(resolveMeetingStage(catalog[4]), null);
  });
});

describe("primeira reunião completed por tipo", () => {
  it("usa somente status completed", () => {
    const rows = firstCompletedMeetingsByStage({
      catalog,
      officialIds: new Set(["u1"]),
      meetings: [
        meeting({ id: "a", status: "scheduled", start_time: "2026-01-05T12:00:00.000Z" }),
        meeting({ id: "b", status: "canceled", start_time: "2026-01-06T12:00:00.000Z" }),
        meeting({ id: "c", status: "completed", start_time: "2026-03-01T12:00:00.000Z" }),
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "c");
  });

  it("a segunda reunião completed do mesmo tipo não altera o marco", () => {
    const rows = firstCompletedMeetingsByStage({
      catalog,
      officialIds: new Set(["u1"]),
      meetings: [
        meeting({ id: "first", start_time: "2026-02-01T12:00:00.000Z" }),
        meeting({ id: "second", start_time: "2026-04-01T12:00:00.000Z" }),
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "first");
    assert.equal(rows[0].occurredAt, "2026-02-01T12:00:00.000Z");
  });

  it("escolhe a primeira completed de cada tipo", () => {
    const rows = firstCompletedMeetingsByStage({
      catalog,
      officialIds: new Set(["u1"]),
      meetings: [
        meeting({ id: "r2", meeting_id: "m-rota", start_time: "2026-03-01T12:00:00.000Z" }),
        meeting({ id: "r1", meeting_id: "m-rota", start_time: "2026-02-01T12:00:00.000Z" }),
        meeting({ id: "g1", meeting_id: "m-gears", start_time: "2026-02-20T12:00:00.000Z" }),
        meeting({ id: "c1", meeting_id: "m-central", start_time: "2026-04-01T12:00:00.000Z" }),
      ],
    });
    const byStage = Object.fromEntries(rows.map((row) => [row.stageKey, row.id]));
    assert.deepEqual(byStage, {
      rota_patrimonial: "r1",
      ativacao_engrenagens: "g1",
      central_inteligencia: "c1",
    });
  });

  it("ignora reuniões fora da população oficial", () => {
    const unofficial = {
      id: "staff",
      email: "pessoa@quartavia.com.br",
      deleted_at: null,
      raw_app_meta_data: { role: "member" },
    };
    assert.equal(isOfficialPharusClient(unofficial), false);
    const rows = firstCompletedMeetingsByStage({
      catalog,
      officialIds: new Set(["u1"]),
      meetings: [
        meeting({ id: "ok", user_id: "u1" }),
        meeting({ id: "staff-meeting", user_id: "staff" }),
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].userId, "u1");
  });
});

describe("mediana e cronologia", () => {
  it("calcula mediana ímpar e par e arredonda de forma amigável", () => {
    assert.equal(median([1, 3, 100]), 3);
    assert.equal(median([2, 4, 6, 8]), 5);
    assert.equal(roundFriendlyDays(15.4), 15);
    assert.equal(roundFriendlyDays(15.6), 16);
    assert.equal(roundFriendlyDays(2.5), 3);
  });

  it("reunião anterior ao cadastro é excluída da mediana e contada como qualidade", () => {
    assert.equal(durationDays("2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z").invalid, "chronology");
    const presented = presentJourneySpeed(
      buildJourneySpeedSource({
        catalog,
        users: [user({ id: "u1", created_at: "2026-03-01T00:00:00.000Z" }), user({ id: "u2", created_at: "2026-01-01T00:00:00.000Z" })],
        meetings: [
          meeting({ id: "bad", user_id: "u1", start_time: "2026-02-01T00:00:00.000Z" }),
          meeting({ id: "ok", user_id: "u2", start_time: "2026-01-16T00:00:00.000Z" }),
        ],
      }),
    );
    const rota = presented.stages.find((stage) => stage.key === "rota_patrimonial");
    assert.equal(rota.reachedCount, 2);
    assert.equal(rota.validDurationCount, 1);
    assert.equal(rota.invalidChronologyCount, 1);
    assert.equal(presented.invalidChronologyCount, 1);
    assert.equal(rota.displayDays, 15);
  });

  it("não permite duração negativa na mediana", () => {
    const presented = presentJourneySpeed(
      buildJourneySpeedSource({
        catalog,
        users: [user({ created_at: "2026-03-01T00:00:00.000Z" })],
        meetings: [meeting({ start_time: "2026-01-01T00:00:00.000Z" })],
      }),
    );
    const rota = presented.stages.find((stage) => stage.key === "rota_patrimonial");
    assert.equal(rota.medianDays, null);
    assert.equal(rota.displayDays, null);
    assert.equal(presented.invalidChronologyCount, 1);
  });
});

describe("acesso à plataforma", () => {
  it("last_sign_in_at nulo conta como nunca acessou", () => {
    assert.equal(hasPlatformAccess(null), false);
    assert.equal(hasPlatformAccess(""), false);
    assert.equal(hasPlatformAccess("2026-01-10T12:00:00.000Z"), true);
    const presented = presentJourneySpeed(
      buildJourneySpeedSource({
        catalog,
        users: [
          user({ id: "u1", last_sign_in_at: null }),
          user({ id: "u2", last_sign_in_at: "2026-01-10T12:00:00.000Z" }),
          user({ id: "u3", last_sign_in_at: "" }),
          user({ id: "u4", last_sign_in_at: "2026-02-01T00:00:00.000Z" }),
        ],
        meetings: [],
      }),
    );
    assert.equal(presented.access.neverAccessed, 2);
    assert.equal(presented.access.accessed, 2);
    assert.equal(presented.access.neverPercent, 50);
    assert.match(presented.kpis.at(-1).note, /50% da base/);
    assert.match(presented.access.insight, /ainda não possuem login registrado/);
  });
});

describe("filtros e cobertura da etapa", () => {
  it("filtra a população pela data de cadastro e depois calcula o marco", () => {
    const source = buildJourneySpeedSource({
      catalog,
      users: [
        user({ id: "old", created_at: "2025-01-10T00:00:00.000Z" }),
        user({ id: "new", created_at: "2026-06-10T00:00:00.000Z" }),
      ],
      meetings: [
        meeting({ id: "old-r", user_id: "old", start_time: "2025-02-01T00:00:00.000Z" }),
        meeting({ id: "new-r", user_id: "new", start_time: "2026-06-20T00:00:00.000Z" }),
      ],
    });
    const all = presentJourneySpeed(source, { period: "all" });
    const filtered = presentJourneySpeed(source, { period: "this_year" });
    assert.equal(all.population, 2);
    assert.equal(all.stages[0].reachedCount, 2);
    assert.equal(filtered.population, 1);
    assert.equal(filtered.periodApplied, true);
    assert.equal(filtered.stages[0].reachedCount, 1);
    assert.equal(filtered.stages[0].displayDays, 10);
  });

  it("etapa sem clientes não inventa mediana", () => {
    const presented = presentJourneySpeed(
      buildJourneySpeedSource({
        catalog,
        users: [user()],
        meetings: [],
      }),
    );
    for (const stage of presented.stages) {
      assert.equal(stage.reachedCount, 0);
      assert.equal(stage.medianDays, null);
      assert.equal(stage.displayDays, null);
    }
    assert.match(speedHBars(presented.chart), /—/);
    assert.match(stackedShareBar(presented.access.segments), /Já acessaram/);
  });

  it("respeita busca e responsável da página Jornada", () => {
    const source = buildJourneySpeedSource({
      catalog,
      users: [
        user({ id: "u1", name: "Ana", email: "ana@x.com", advisorId: "ep-1", created_at: "2026-01-01T00:00:00.000Z" }),
        user({ id: "u2", name: "Bruno", email: "bruno@x.com", advisorId: "ep-2", created_at: "2026-01-01T00:00:00.000Z" }),
      ],
      meetings: [
        meeting({ id: "a", user_id: "u1", start_time: "2026-01-11T00:00:00.000Z" }),
        meeting({ id: "b", user_id: "u2", start_time: "2026-01-21T00:00:00.000Z" }),
      ],
    });
    const bySearch = presentJourneySpeed(source, { period: "all", search: "bruno" });
    const byAdvisor = presentJourneySpeed(source, { period: "all", advisor: "ep-1" });
    assert.equal(bySearch.population, 1);
    assert.equal(bySearch.stages[0].reachedCount, 1);
    assert.equal(bySearch.stages[0].displayDays, 20);
    assert.equal(byAdvisor.population, 1);
    assert.equal(byAdvisor.stages[0].displayDays, 10);
  });
});

describe("localização da seção na UI", () => {
  it("sai da Visão Geral e entra na Jornada com a mesma numeração", async () => {
    const [visao, jornada] = await Promise.all([
      readFile(new URL("../../js/pages/visao-geral.js", import.meta.url), "utf8"),
      readFile(new URL("../../js/pages/jornada.js", import.meta.url), "utf8"),
    ]);
    assert.doesNotMatch(visao, /Velocidade da jornada/);
    assert.doesNotMatch(visao, /sec-journey-speed|renderJourneySpeed|journeySpeed/);
    assert.match(visao, /4\. Principais alertas/);
    assert.doesNotMatch(visao, /5\. Principais alertas/);
    assert.match(jornada, /3\. Velocidade da jornada/);
    assert.match(jornada, /renderJourneySpeedSection/);
    assert.match(jornada, /2\. Funil da jornada/);
    assert.match(jornada, /4\. Tempo entre etapas/);
    assert.match(jornada, /5\. Saúde operacional/);
    assert.match(jornada, /6\. Posição por cliente/);
  });

  it("a página Jornada não expõe filtro de período", () => {
    const fields = PAGE_FILTERS().jornada;
    assert.equal(fields.some((field) => field.key === "period"), false);
    assert.equal(fields.some((field) => field.key === "search"), true);
    assert.equal(fields.some((field) => field.key === "advisor"), true);
  });

  it("os gráficos da seção recebem os mesmos dados do presenter", () => {
    const presented = presentJourneySpeed(
      buildJourneySpeedSource({
        catalog,
        users: [user({ created_at: "2026-01-01T00:00:00.000Z" })],
        meetings: [meeting({ start_time: "2026-01-16T00:00:00.000Z" })],
      }),
    );
    const html = renderJourneySpeedSection(presented);
    assert.match(html, /Mediana até Rota Patrimonial/);
    assert.match(html, /Tempo típico até cada etapa/);
    assert.match(html, /Acesso à plataforma/);
    assert.match(html, /15 dias/);
    assert.equal(presented.chart[0].displayDays, 15);
  });
});

describe("payload ausente não vira zero", () => {
  it("marca a seção como indisponível quando a fonte não chega", () => {
    const missing = presentJourneySpeed(undefined);
    assert.equal(missing.status, "unavailable");
    assert.equal(missing.population, null);
    assert.equal(missing.stages[0].reachedCount, null);
    assert.equal(missing.access.neverAccessed, null);
    for (const kpi of missing.kpis) {
      assert.equal(kpi.status, "unavailable");
      assert.notEqual(kpi.value, 0);
      assert.doesNotMatch(String(kpi.note), /^0 clientes/);
    }
    const html = renderJourneySpeedSection(missing);
    assert.match(html, /Não foi possível carregar a velocidade da jornada/);
    assert.doesNotMatch(html, /0 clientes chegaram à etapa/);
    assert.doesNotMatch(html, /0% da base/);
  });

  it("zero real só aparece quando a fonte existe e a etapa está vazia", () => {
    const presented = presentJourneySpeed(
      buildJourneySpeedSource({
        catalog,
        users: [user()],
        meetings: [],
      }),
    );
    assert.equal(presented.status, "ok");
    assert.equal(presented.population, 1);
    assert.equal(presented.stages[0].reachedCount, 0);
    assert.equal(presented.stages[0].displayDays, null);
    assert.match(presented.kpis[0].note, /0 clientes chegaram à etapa/);
  });

  it("renderer não converte cobertura ausente em zero", () => {
    assert.equal(formatKpiValue({ kind: "days", value: null }), "—");
    assert.equal(formatKpiValue({ status: "unavailable", value: "Não disponível" }), "Não disponível");
    const html = stackedShareBar([
      { key: "accessed", label: "Já acessaram", count: null, percent: null },
      { key: "never", label: "Nunca acessaram", count: null, percent: null },
    ]);
    assert.match(html, /Acesso à plataforma indisponível/);
    assert.doesNotMatch(html, /0 ·/);
    const bars = speedHBars([
      { label: "Rota Patrimonial", displayDays: null, reachedCount: null },
    ]);
    assert.match(bars, /cobertura da etapa indisponível/);
    assert.doesNotMatch(bars, /0 clientes chegaram à etapa/);
  });
});
