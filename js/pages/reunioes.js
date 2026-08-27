import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, dualColumns, hBars } from "../components/charts.mjs";
import { openMeetingDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { statusBadge } from "../components/status-badge.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getMeetingsPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatNumber } from "../utils/format.mjs";

const meetingsTable = mountInteractiveTable("meetings-table-host", {
  defaultState: { sortKey: "date", sortDir: "desc" },
  searchPlaceholder: "Buscar cliente, tipo ou responsável",
  title: (rows) => `${formatNumber(rows.length)} reuniões`,
  columns: [
    { key: "clientName", label: "Cliente", sortable: true, value: (row) => escapeHtml(row.clientName) },
    { key: "type", label: "Tipo", sortable: true, value: (row) => escapeHtml(row.type) },
    { key: "date", label: "Data", sortable: true, value: (row) => formatDate(row.date) },
    { key: "status", label: "Status", sortable: true, value: (row) => statusBadge(row.status) },
    { key: "advisor", label: "Responsável", sortable: true, value: (row) => escapeHtml(row.advisor) },
    { key: "score", label: "Avaliação", sortable: true, numeric: true, sortValue: (row) => row.score ?? -1, value: (row) => (row.score == null ? "Não informado" : `${row.score} de 5`) },
    { key: "outputs", label: "Outputs", sortable: true, numeric: true, value: (row) => formatNumber(row.outputs) },
  ],
  onRowClick: (row) => openMeetingDrawer(row),
});

export function bootReunioes() {
  mountPage({
    pageId: "reunioes",
    load: getMeetingsPage,
    render: (data) => {
      queueMicrotask(() => meetingsTable.mount({ rows: data.rows || [] }));
      return `
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
        lead: "Clique em uma reunião para ver detalhes no drawer.",
        body: `<div id="meetings-table-host"><p class="placeholder-note">Carregando tabela…</p></div>`,
      })}
    `;
    },
  });
}
