import { chartCard } from "../components/chart-card.mjs";
import { monthColumns } from "../components/charts.mjs";
import { openPaymentDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getPaymentsPage } from "../services/app-pharus/domain-pages.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate } from "../utils/format.mjs";

const paymentsTable = mountInteractiveTable("payments-table-host", {
  defaultState: { sortKey: "date", sortDir: "desc" },
  title: (rows) => `${rows.length} registros`,
  rowIdKey: "id",
  columns: [
    { key: "clientName", label: "Cliente", sortable: true, value: (row) => escapeHtml(row.clientName) },
    { key: "date", label: "Pagamento", sortable: true, value: (row) => formatDate(row.date) },
    { key: "cycleStart", label: "Início do ciclo", sortable: true, value: (row) => formatDate(row.cycleStart) },
    { key: "cycleEnd", label: "Fim do ciclo", sortable: true, value: (row) => formatDate(row.cycleEnd) },
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
        ${methodologyBanner("core.user_payments registra ciclo e data de pagamento, mas não possui valor monetário. Nenhum total financeiro é inferido.")}
        ${sectionBlock({ id: "sec-pay-kpis", title: "1. Resumo dos pagamentos", body: kpiRow(data.kpis.slice(0, 3).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { featured: true, tooltip: kpi.note })), "kpi-row-primary") + kpiRow(data.kpis.slice(3).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { compact: true })), "kpi-row-secondary") })}
        ${sectionBlock({ id: "sec-pay-chart", title: "2. Evolução mensal", body: chartCard({ title: "Registros por mês", subtitle: "Contagem de registros reais", body: monthColumns(data.monthly, { valueKey: "count", titleSuffix: "registros", maxItems: 12 }) }) })}
        ${sectionBlock({ id: "sec-pay-table", title: "3. Pagamentos", lead: "Clique em um registro para ver ciclo e data.", body: `<div id="payments-table-host"><p class="placeholder-note">Carregando tabela…</p></div>` })}
      `;
    },
  });
}
