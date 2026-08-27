import { chartCard } from "../components/chart-card.mjs";
import { monthColumns } from "../components/charts.mjs";
import { openPaymentDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getPaymentsPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatCurrency, formatDate } from "../utils/format.mjs";

const paymentsTable = mountInteractiveTable("payments-table-host", {
  defaultState: { sortKey: "date", sortDir: "desc" },
  searchPlaceholder: "Buscar cliente",
  title: (rows) => `${rows.length} pagamentos`,
  rowIdKey: "id",
  columns: [
    { key: "clientName", label: "Cliente", sortable: true, value: (row) => escapeHtml(row.clientName) },
    { key: "amount", label: "Valor", sortable: true, numeric: true, sortValue: (row) => row.amount || 0, value: (row) => formatCurrency(row.amount) },
    { key: "date", label: "Data", sortable: true, value: (row) => formatDate(row.date) },
  ],
  onRowClick: (row) => openPaymentDrawer(row),
});

export function bootPagamentos() {
  mountPage({
    pageId: "pagamentos",
    load: getPaymentsPage,
    render: (data) => {
      queueMicrotask(() => paymentsTable.mount({ rows: data.rows || [] }));
      return `
      ${methodologyBanner("Estes valores existem no App Pharus. Não interpretar como receita oficial da QuartaVia.")}
      ${sectionBlock({
        id: "sec-pay-kpis",
        title: "1. Resumo dos pagamentos",
        body: kpiRow(data.kpis.slice(0, 3).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { featured: true, tooltip: kpi.note })), "kpi-row-primary")
          + kpiRow(data.kpis.slice(3).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { compact: true })), "kpi-row-secondary"),
      })}
      ${sectionBlock({
        id: "sec-pay-chart",
        title: "2. Evolução mensal",
        body: chartCard({
          title: "Valor registrado por mês",
          subtitle: "Série de demonstração",
          body: monthColumns(data.monthly.map((item) => ({ month: item.month, count: item.amount })), { titleSuffix: "registrados" }),
        }),
      })}
      ${sectionBlock({
        id: "sec-pay-table",
        title: "3. Pagamentos",
        lead: "Clique em um pagamento para ver detalhes.",
        body: `<div id="payments-table-host"><p class="placeholder-note">Carregando tabela…</p></div>`,
      })}
    `;
    },
  });
}
