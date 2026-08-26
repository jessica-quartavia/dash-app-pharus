import { chartCard } from "../components/chart-card.mjs";
import { monthColumns } from "../components/charts.mjs";
import { dataTable, tablePanel } from "../components/data-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getPaymentsPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatCurrency, formatDate } from "../utils/format.mjs";

export function bootPagamentos() {
  mountPage({
    pageId: "pagamentos",
    load: getPaymentsPage,
    render: (data) => `
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
        body: tablePanel({
          title: "Registros do App",
          table: dataTable({
            columns: [
              { label: "Cliente", value: (row) => escapeHtml(row.clientName) },
              { label: "Valor", numeric: true, value: (row) => formatCurrency(row.amount) },
              { label: "Data", value: (row) => formatDate(row.date) },
            ],
            rows: data.rows,
          }),
        }),
      })}
    `,
  });
}
