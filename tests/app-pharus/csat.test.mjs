import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyCsatRating, ratingDistribution, roundCsatAverage } from "../../lib/app-pharus/csat-rating.mjs";
import { filterCsatRows, presentCsatPage } from "../../lib/app-pharus/present-csat.mjs";
import { defaultTableState, renderInteractiveTablePanel } from "../../js/components/interactive-table.mjs";
import { paginateRows } from "../../js/components/table-pagination.mjs";
import { renderCsatPage } from "../../js/pages/csat.js";
import { getPageById, getPagesByGroup } from "../../js/pages.js";
import { PAGE_FILTERS } from "../../js/lib/filters/contracts.mjs";
import { defaultFilters } from "../../js/lib/filters/apply.mjs";
import { formatKpiValue } from "../../js/lib/kpi-value.mjs";
import { loadingState } from "../../js/components/loading-state.mjs";
import { errorState } from "../../js/components/error-state.mjs";
import { navIcon } from "../../js/nav-icons.mjs";

const dataset = {
  advisors: [{ id: "ep-1", name: "Ana" }],
  screens: [{ key: "csat_open_finance", title: "CSAT — Open Finance" }],
  completedMeetings: [
    { id: "sm-1", date: "2026-08-10", status: "completed" },
    { id: "sm-2", date: "2026-08-11", status: "completed" },
  ],
  quality: {
    meetingsWithoutScore: 0,
    platformWithoutComment: 1,
    duplicateMeetingEvaluations: 0,
    duplicatePlatformPairs: 0,
  },
  rows: [
    {
      id: "m1",
      origin: "meetings",
      originLabel: "Reuniões",
      score: 5,
      createdAt: "2026-08-10T12:00:00.000Z",
      clientId: "a",
      clientName: "Alpha",
      clientEmail: "alpha@example.com",
      advisorId: "ep-1",
      advisor: "Ana",
      subject: "Rota Patrimonial",
      meetingType: "Rota Patrimonial",
      comment: "Ótima reunião",
      positivePoints: ["Clareza"],
      improvementPoints: [],
      classification: classifyCsatRating(5),
    },
    {
      id: "m2",
      origin: "meetings",
      originLabel: "Reuniões",
      score: 4,
      createdAt: "2026-08-11T12:00:00.000Z",
      clientId: "b",
      clientName: "Beta",
      clientEmail: "beta@example.com",
      advisorId: "ep-1",
      advisor: "Ana",
      subject: "Central",
      meetingType: "Central",
      comment: null,
      positivePoints: [],
      improvementPoints: ["Organização"],
      classification: classifyCsatRating(4),
    },
    {
      id: "p1",
      origin: "platform",
      originLabel: "Plataforma",
      score: 5,
      createdAt: "2026-08-12T12:00:00.000Z",
      clientId: "a",
      clientName: "Alpha",
      clientEmail: "alpha@example.com",
      advisorId: "ep-1",
      advisor: "Ana",
      subject: "CSAT — Open Finance",
      screenKey: "csat_open_finance",
      screenTitle: "CSAT — Open Finance",
      comment: null,
      positivePoints: ["Visualização dos dados é clara"],
      improvementPoints: [],
      classification: classifyCsatRating(5),
    },
  ],
};

test("página CSAT está registrada na operação, depois de Pagamentos", () => {
  const page = getPageById("csat");
  assert.equal(page.implemented, true);
  assert.equal(page.group, "operacao");
  const operacao = getPagesByGroup("operacao").map((item) => item.id);
  assert.deepEqual(operacao, ["pagamentos", "csat", "qualidade"]);
  assert.match(navIcon("csat"), /svg/);
  assert.ok(PAGE_FILTERS().csat.some((field) => field.key === "origin"));
  assert.ok(PAGE_FILTERS().csat.some((field) => field.key === "rating"));
  assert.equal(defaultFilters().origin, "all");
});

test("nota 4 permanece pendente e não é classificada sozinha", () => {
  const four = classifyCsatRating(4);
  assert.equal(four.classificationPending, true);
  assert.equal(four.bucket, null);
  assert.equal(classifyCsatRating(5).bucket, "positive");
  assert.equal(classifyCsatRating(3).bucket, "improvement");
  assert.equal(classifyCsatRating(null).reason, "missing_score");
});

test("média usa uma casa decimal e a distribuição cobre 1 a 5", () => {
  assert.equal(roundCsatAverage([5, 5, 4]), 4.7);
  const dist = ratingDistribution([5, 5, 4]);
  assert.deepEqual(dist.map((item) => item.stars), [1, 2, 3, 4, 5]);
  assert.equal(dist.find((item) => item.stars === 5).count, 2);
  assert.equal(dist.find((item) => item.stars === 1).count, 0);
  assert.match(formatKpiValue({ kind: "decimal", digits: 1, value: 4.812736 }), /^4,8$/);
});

test("filtros separam reuniões da plataforma e respeitam busca", () => {
  const meetings = presentCsatPage(dataset, { origin: "meetings", period: "all" });
  assert.equal(meetings.rows.every((row) => row.origin === "meetings"), true);
  assert.equal(meetings.kpis[0].value, 2);
  assert.equal(meetings.originCards.length, 1);
  const search = presentCsatPage(dataset, { period: "all", search: "beta" });
  assert.equal(search.rows.length, 1);
  assert.equal(search.rows[0].id, "m2");
  const rating = filterCsatRows(dataset.rows, { period: "all", rating: "5" });
  assert.equal(rating.length, 2);
  const screen = presentCsatPage(dataset, { period: "all", screen: "csat_open_finance" });
  assert.equal(screen.rows.length, 1);
  assert.equal(screen.platform.byScreen[0].label, "CSAT — Open Finance");
});

test("reuniões e plataforma mantêm médias e pontos do banco", () => {
  const page = presentCsatPage(dataset, { period: "all" });
  assert.equal(page.meetings.average, 4.5);
  assert.equal(page.platform.average, 5);
  assert.equal(page.meetings.positivePoints[0].label, "Clareza");
  assert.equal(page.meetings.improvementPoints[0].label, "Organização");
  assert.equal(page.kpis.find((item) => item.key === "positive").value, 2);
  assert.equal(page.kpis.some((item) => item.key === "coverage"), false);
});

test("tabela pagina de 25 e o HTML não mistura as seções", () => {
  const page = presentCsatPage(dataset, { period: "all" });
  const html = renderCsatPage(page);
  assert.match(html, /1\. Visão geral do CSAT/);
  assert.match(html, /2\. CSAT das Reuniões/);
  assert.match(html, /3\. CSAT da Plataforma/);
  assert.match(html, /4\. Feedbacks/);
  assert.match(html, /CSAT por tela/);
  assert.match(html, /csat-rank-table/);
  const state = defaultTableState();
  assert.equal(state.pageSize, 25);
  const paged = paginateRows(Array.from({ length: 40 }, (_, index) => ({ id: index })), { page: 1, pageSize: 25 });
  assert.equal(paged.rows.length, 25);
  const panel = renderInteractiveTablePanel({
    rows: page.rows,
    columns: [{ key: "clientName", label: "Cliente", sortable: true, value: (row) => row.clientName }],
    state,
    title: () => "t",
  });
  assert.match(panel, /Alpha|Beta/);
});

test("loading e erro não usam zero como estado vazio", () => {
  const loading = loadingState();
  assert.match(loading, /ui-skeleton|Carregando/);
  assert.doesNotMatch(loading, />0</);
  const error = errorState({ title: "Não foi possível carregar esta página" });
  assert.match(error, /Não foi possível carregar esta página/);
});

test("endpoint CSAT é serverless e não expõe service role no browser", async () => {
  const source = await readFile(new URL("../../api/csat.js", import.meta.url), "utf8");
  assert.match(source, /requireCorporateAuth/);
  assert.match(source, /buildCsatDataset/);
  assert.doesNotMatch(source, /C:\\\\Users/);
  const client = await readFile(new URL("../../js/services/app-pharus/csat.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(client, /SERVICE_ROLE|service_role/);
  const pageSource = await readFile(new URL("../../js/pages/csat.js", import.meta.url), "utf8");
  assert.match(pageSource, /openCsatDrawer/);
  assert.match(pageSource, /25/);
});
