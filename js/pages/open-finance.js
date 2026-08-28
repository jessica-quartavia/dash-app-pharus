import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, hBars, monthColumns } from "../components/charts.mjs";
import { openOpenFinanceDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { statusBadge } from "../components/status-badge.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getOpenFinancePage } from "../services/app-pharus/domain-pages.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDateTime, formatNumber } from "../utils/format.mjs";

const ofTable = mountInteractiveTable("of-table-host", {
  defaultState: { sortKey: "clientName", sortDir: "asc" },
  title: (rows) => `${formatNumber(rows.length)} conexões`,
  rowIdKey: "id",
  columns: [
    { key: "clientName", label: "Cliente", sortable: true, value: (row) => escapeHtml(row.clientName) },
    { key: "institution", label: "Instituição", sortable: true, value: (row) => escapeHtml(row.institution) },
    { key: "result", label: "Resultado", sortable: true, value: (row) => statusBadge(row.result || row.status) },
    { key: "accounts", label: "Contas", sortable: true, numeric: true, value: (row) => formatNumber(row.accounts) },
    { key: "lastSyncAt", label: "Última sincronização", sortable: true, value: (row) => formatDateTime(row.lastSyncAt) },
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
        ${methodologyBanner("Conexão válida = is_open_finance true e item_status UPDATED. Campos ausentes não são convertidos em zero.")}
        ${sectionBlock({ id: "sec-of-kpis", title: "1. Resumo das conexões", body: kpiRow(data.kpis.slice(0, 4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { featured: true, tooltip: kpi.note })), "kpi-row-primary") + kpiRow(data.kpis.slice(4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { compact: true })), "kpi-row-secondary") })}
        ${sectionBlock({
          id: "sec-of-charts",
          title: "2. Evolução e composição",
          body: chartGrid([
            chartCard({ title: "Novas conexões válidas", body: monthColumns(data.monthly, { valueKey: "count", titleSuffix: "conexões", maxItems: 12 }) }),
            chartCard({ title: "Status das conexões", body: donut(data.status) }),
            chartCard({ title: "Instituições conectadas", body: hBars(data.institutions) }),
            chartCard({ title: "Contas por tipo", body: hBars(data.accountTypes) }),
          ]),
        })}
        ${sectionBlock({ id: "sec-of-table", title: "3. Conexões", lead: "Clique em uma linha para ver detalhes da conexão.", body: `<div id="of-table-host"><p class="placeholder-note">Carregando tabela…</p></div>` })}
      `;
    },
  });
}
