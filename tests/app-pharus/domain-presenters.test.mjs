import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  presentFormsPage,
  presentJourneyPage,
  presentMeetingsPage,
  presentOpenFinancePage,
  presentPaymentsPage,
  presentWealthPage,
} from "../../lib/app-pharus/domain-presenters.mjs";
import { defaultTableState, renderInteractiveTablePanel } from "../../js/components/interactive-table.mjs";
import { formatKpiValue } from "../../js/lib/kpi-value.mjs";

const clients = [
  { id: "a", name: "Alpha", email: "alpha@example.com", registeredAt: "2026-01-01", hasOpenFinance: true },
  { id: "b", name: "Beta", email: "beta@example.com", registeredAt: "2026-01-01", hasOpenFinance: false },
];
const onlyBeta = { period: "all", search: "beta" };

describe("apresentadores das páginas de domínio", () => {
  it("aplica a busca global da FilterBar a KPIs, gráficos e tabelas", () => {
    const journey = presentJourneyPage({ clients, progress: [
      { user_id: "a", step: "complete", created_at: "2026-01-01", completed_at: "2026-01-02" },
      { user_id: "b", step: "intelligence_center", created_at: "2026-01-03", completed_at: null },
    ], stages: [{ user_id: "a", current_stage: "Onboarding" }, { user_id: "b", current_stage: "Central" }] }, onlyBeta);
    assert.equal(journey.kpis[0].value, 1);
    assert.equal(journey.kpis[2].value, 1);
    assert.equal(journey.rows.length, 1);
    assert.equal(journey.byStage.reduce((sum, item) => sum + item.count, 0), 1);

    const meetings = presentMeetingsPage({ clients, rows: [
      { id: "m1", clientId: "a", date: "2026-01-10", status: "completed", type: "Rota", score: 5, highlights: [], attentionPoints: [] },
      { id: "m2", clientId: "b", date: "2026-01-11", status: "scheduled", type: "Central", score: null, highlights: [], attentionPoints: [] },
    ] }, onlyBeta);
    assert.equal(meetings.kpis[0].value, 1);
    assert.equal(meetings.rows[0].id, "m2");
    assert.equal(meetings.byType.reduce((sum, item) => sum + item.count, 0), 1);

    const forms = presentFormsPage({ clients, forms: [{ id: "f1" }], rows: [
      { id: "f-a", clientId: "a", startedAt: "2026-01-01", completedAt: "2026-01-02", formName: "Perfil", status: "Concluído" },
      { id: "f-b", clientId: "b", startedAt: "2026-01-01", completedAt: null, formName: "Perfil", status: "Iniciado" },
    ] }, onlyBeta);
    assert.equal(forms.kpis[1].value, 1);
    assert.equal(forms.rows[0].id, "f-b");

    const payments = presentPaymentsPage({ clients, amountAvailable: false, rows: [
      { id: "p-a", clientId: "a", date: "2026-01-01" },
      { id: "p-b", clientId: "b", date: "2026-01-02" },
    ] }, onlyBeta);
    assert.equal(payments.kpis[1].value, 1);
    assert.equal(payments.rows[0].id, "p-b");
    assert.equal(payments.amountAvailable, false);

    const openFinance = presentOpenFinancePage({ clients, accounts: [
      { id: "acc-a-1", user_id: "a" },
      { id: "acc-a-2", user_id: "a" },
      { id: "acc-b-1", user_id: "b" },
    ], rows: [
      { id: "of-a", clientId: "a", createdAt: "2026-01-01", isOpenFinance: true, status: "UPDATED", accountTypes: [] },
      { id: "of-b", clientId: "b", createdAt: "2026-01-01", isOpenFinance: true, status: "UPDATED", accountTypes: [] },
    ] }, onlyBeta);
    assert.equal(openFinance.kpis[0].value, 1);
    assert.equal(openFinance.kpis[2].value, 1);
    assert.equal(openFinance.kpis[3].value, 1);
  });

  it("distingue patrimônio de passivos e não duplica contas por conexão", () => {
    const wealth = presentWealthPage({ clients, rows: [
      { ...clients[0], wealth: { assets: 100, liabilities: 0, hasAssets: true, hasLiabilities: false, classes: { Ações: 100 } } },
      { ...clients[1], wealth: { assets: 0, liabilities: 50, hasAssets: false, hasLiabilities: true, classes: { Empréstimos: 50 } } },
    ], totalsByClass: [{ label: "Empréstimos", liability: true }] }, { period: "all" });
    assert.equal(wealth.kpis[3].value, 1);
    assert.equal(wealth.kpis[0].value, 100);
    assert.equal(wealth.kpis[1].value, 50);

    const openFinance = presentOpenFinancePage({ clients, accounts: [
      { id: "acc-1", user_id: "a" }, { id: "acc-1", user_id: "a" }, { id: "acc-2", user_id: "a" }, { id: "acc-3", user_id: "b" },
    ], rows: [
      { id: "c1", clientId: "a", createdAt: "2026-01-01", isOpenFinance: true, status: "UPDATED", accountTypes: [] },
      { id: "c2", clientId: "a", createdAt: "2026-01-02", isOpenFinance: true, status: "UPDATED", accountTypes: [] },
    ] }, { period: "all" });
    assert.equal(openFinance.kpis[0].value, 1);
    assert.equal(openFinance.kpis[1].value, 2);
    assert.equal(openFinance.kpis[2].value, 2);
    assert.equal(openFinance.kpis[3].value, 2);
    assert.equal(openFinance.kpis[3].note, "Média entre clientes conectados");
  });

  it("calcula a média de contas sem arredondar antes da apresentação", () => {
    const connectedClients = Array.from({ length: 131 }, (_, index) => ({
      id: `client-${index}`,
      name: `Cliente ${index}`,
      registeredAt: "2026-01-01",
      hasOpenFinance: true,
    }));
    const connections = connectedClients.map((client, index) => ({
      id: `connection-${index}`,
      clientId: client.id,
      createdAt: "2026-01-01",
      isOpenFinance: true,
      status: "UPDATED",
      accountTypes: [],
    }));
    const accounts = Array.from({ length: 898 }, (_, index) => ({
      id: `account-${index}`,
      user_id: connectedClients[index % connectedClients.length].id,
    }));
    accounts.push({ ...accounts[0] });

    const result = presentOpenFinancePage({ clients: connectedClients, rows: connections, accounts }, { period: "all" });
    const average = result.kpis.find(({ label }) => label === "Média de contas por cliente");

    assert.equal(result.kpis.find(({ label }) => label === "Contas conectadas").value, 898);
    assert.equal(average.value, 898 / 131);
    assert.equal(average.kind, "decimal");
    assert.equal(average.digits, 0);
    assert.equal(formatKpiValue(average), "7");
  });
});

describe("tabela interativa", () => {
  it("usa paginação de 25 e não renderiza busca duplicada por padrão", () => {
    const html = renderInteractiveTablePanel({
      rows: [{ id: "1", name: "Cliente" }],
      columns: [{ key: "name", label: "Nome", value: (row) => row.name }],
      state: defaultTableState(),
    });
    assert.equal(defaultTableState().pageSize, 25);
    assert.doesNotMatch(html, /data-table-search/);
  });
});
