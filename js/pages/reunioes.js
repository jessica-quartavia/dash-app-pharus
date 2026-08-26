import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, dualColumns, hBars } from "../components/charts.mjs";
import { dataTable, tablePanel } from "../components/data-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { statusBadge } from "../components/status-badge.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getMeetingsPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatNumber } from "../utils/format.mjs";

export function bootReunioes() {
  mountPage({
    pageId: "reunioes",
    load: getMeetingsPage,
    render: (data) => `
      ${methodologyBanner("Comparecimento = reuniões realizadas sobre o total agendado no recorte.")}
      ${sectionBlock({
        id: "sec-meet-kpis",
        title: "1. Resumo das reuniões",
        body: kpiRow(data.kpis.slice(0, 4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { featured: true, tooltip: kpi.note })), "kpi-row-primary")
          + kpiRow(data.kpis.slice(4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { compact: true })), "kpi-row-secondary"),
      })}
      ${sectionBlock({
        id: "sec-meet-charts",
        title: "2. Cadência e qualidade",
        body: chartGrid([
          chartCard({
            title: "Reuniões por mês",
            body: dualColumns(data.monthly, {
              primaryKey: "scheduled",
              secondaryKey: "completed",
              primaryLabel: "Agendadas",
              secondaryLabel: "Realizadas",
            }),
          }),
          chartCard({ title: "Reuniões por tipo", body: donut(data.byType) }),
          chartCard({ title: "Status das reuniões", body: hBars(data.byStatus) }),
          chartCard({ title: "Intervalo entre reuniões", body: hBars(data.intervals) }),
          chartCard({ title: "Avaliações", body: hBars(data.scores) }),
        ]),
      })}
      ${sectionBlock({
        id: "sec-meet-table",
        title: "3. Reuniões",
        body: tablePanel({
          title: `${formatNumber(data.rows.length)} registros`,
          table: dataTable({
            columns: [
              { label: "Cliente", value: (row) => escapeHtml(row.clientName) },
              { label: "Tipo", value: (row) => escapeHtml(row.type) },
              { label: "Data", value: (row) => formatDate(row.date) },
              { label: "Status", value: (row) => statusBadge(row.status) },
              { label: "Responsável", value: (row) => escapeHtml(row.advisor) },
              { label: "Avaliação", numeric: true, value: (row) => (row.score == null ? "Não informado" : `${row.score} de 5`) },
              { label: "Outputs", numeric: true, value: (row) => formatNumber(row.outputs) },
            ],
            rows: data.rows,
          }),
        }),
      })}
    `,
  });
}
