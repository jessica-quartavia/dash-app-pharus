import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, dualColumns, hBars, monthColumns } from "../components/charts.mjs";
import { openOpenFinanceDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { statusBadge } from "../components/status-badge.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getOpenFinancePage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDateTime, formatNumber } from "../utils/format.mjs";

const ofTable = mountInteractiveTable("of-table-host", {
  defaultState: { sortKey: "clientName", sortDir: "asc" },
  searchPlaceholder: "Buscar cliente ou instituição",
  title: (rows) => `${formatNumber(rows.length)} conexões`,
  rowIdKey: "id",
  columns: [
    { key: "clientName", label: "Cliente", sortable: true, value: (row) => escapeHtml(row.clientName) },
    { key: "institution", label: "Instituição", sortable: true, value: (row) => escapeHtml(row.institution) },
    { key: "result", label: "Status", sortable: true, value: (row) => statusBadge(row.result) },
    { key: "accounts", label: "Contas", sortable: true, numeric: true, value: (row) => formatNumber(row.accounts) },
    { key: "lastSyncAt", label: "Última sincronização", sortable: true, value: (row) => formatDateTime(row.lastSyncAt) },
    { key: "health", label: "Situação", sortable: true, value: (row) => statusBadge(row.health) },
  ],
  onRowClick: (row) => openOpenFinanceDrawer(row),
});

export function bootOpenFinance() {
  mountPage({
    pageId: "open_finance",
    load: getOpenFinancePage,
    render: (data) => {
      queueMicrotask(() => ofTable.mount({ rows: data.rows || [] }));
      return `
      ${methodologyBanner("Saúde das integrações usa o status da última sincronização de demonstração.")}
      ${sectionBlock({
        id: "sec-of-kpis",
        title: "1. Resumo das conexões",
        lead: "Clientes conectados, contas e qualidade da sincronização.",
        body: kpiRow(data.kpis.slice(0, 4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { featured: true, tooltip: kpi.note })), "kpi-row-primary")
          + kpiRow(data.kpis.slice(4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { compact: true })), "kpi-row-secondary"),
      })}
      ${sectionBlock({
        id: "sec-of-health",
        title: "2. Saúde das integrações",
        lead: "Saudável, atenção ou falha — a falha não é escondida.",
        body: `<div class="health-grid">
          <article class="health-card"><p class="eyebrow">Saudável</p><p class="count">${formatNumber(data.health.Saudável)}</p><p class="note-muted">Sincronização útil</p></article>
          <article class="health-card"><p class="eyebrow">Atenção</p><p class="count">${formatNumber(data.health.Atenção)}</p><p class="note-muted">Sucesso parcial</p></article>
          <article class="health-card"><p class="eyebrow">Falha</p><p class="count">${formatNumber(data.health.Falha)}</p><p class="note-muted">Sem dado confiável</p></article>
        </div>`,
      })}
      ${sectionBlock({
        id: "sec-of-charts",
        title: "3. Evolução e composição",
        body: chartGrid([
          chartCard({ title: "Evolução das conexões", body: monthColumns(data.monthly.map((item) => ({ month: item.month, count: item.connections }))) }),
          chartCard({ title: "Status das conexões", body: donut(data.status) }),
          chartCard({ title: "Instituições conectadas", body: hBars(data.institutions) }),
          chartCard({ title: "Contas por tipo", body: hBars(data.accountTypes.filter((item) => item.count > 0)) }),
          chartCard({
            title: "Receitas x despesas",
            body: dualColumns(data.cashflow, {
              primaryKey: "income",
              secondaryKey: "expense",
              primaryLabel: "Receitas",
              secondaryLabel: "Despesas",
            }),
          }),
          chartCard({ title: "Despesas por categoria", subtitle: "Não informado aparece por último", body: hBars(data.expenses) }),
        ]),
      })}
      ${sectionBlock({
        id: "sec-of-table",
        title: "4. Conexões",
        lead: "Clique em uma linha para ver detalhes da conexão.",
        body: `<div id="of-table-host"><p class="placeholder-note">Carregando tabela…</p></div>`,
      })}
    `;
    },
  });
}
