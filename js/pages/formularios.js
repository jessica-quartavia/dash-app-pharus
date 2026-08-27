import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, hBars, monthColumns } from "../components/charts.mjs";
import { openFormDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { statusBadge } from "../components/status-badge.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getFormsPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatPercent } from "../utils/format.mjs";

const formsTable = mountInteractiveTable("forms-table-host", {
  defaultState: { sortKey: "startedAt", sortDir: "desc" },
  searchPlaceholder: "Buscar cliente ou formulário",
  title: (rows) => `${rows.length} respostas`,
  rowIdKey: "id",
  columns: [
    { key: "clientName", label: "Cliente", sortable: true, value: (row) => escapeHtml(row.clientName) },
    { key: "formName", label: "Formulário", sortable: true, value: (row) => escapeHtml(row.formName) },
    { key: "status", label: "Status", sortable: true, value: (row) => statusBadge(row.status) },
    { key: "startedAt", label: "Data de início", sortable: true, value: (row) => formatDate(row.startedAt) },
    { key: "completedAt", label: "Data de conclusão", sortable: true, value: (row) => formatDate(row.completedAt) },
    { key: "progress", label: "Progresso", sortable: true, numeric: true, value: (row) => formatPercent(row.progress) },
  ],
  onRowClick: (row) => openFormDrawer(row),
});

export function bootFormularios() {
  mountPage({
    pageId: "formularios",
    load: getFormsPage,
    render: (data) => {
      queueMicrotask(() => formsTable.mount({ rows: data.rows || [] }));
      return `
      ${methodologyBanner("Há pelo menos o quiz comportamental e o questionário de alinhamento.")}
      ${sectionBlock({
        id: "sec-form-kpis",
        title: "1. Resumo dos formulários",
        body: kpiRow(data.kpis.slice(0, 4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { featured: true, tooltip: kpi.note })), "kpi-row-primary")
          + kpiRow(data.kpis.slice(4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { compact: true })), "kpi-row-secondary"),
      })}
      ${sectionBlock({
        id: "sec-form-charts",
        title: "2. Preenchimento e perfis",
        body: chartGrid([
          chartCard({ title: "Preenchimento por formulário", body: hBars(data.byForm) }),
          chartCard({ title: "Evolução de respostas", body: monthColumns(data.monthly) }),
          chartCard({ title: "Taxa de conclusão", body: donut(data.completion) }),
          chartCard({ title: "Principais perfis", subtitle: "Quando a resposta foi concluída", body: hBars(data.profiles) }),
        ]),
      })}
      ${sectionBlock({
        id: "sec-form-table",
        title: "3. Respostas",
        lead: "Clique em uma linha para ver detalhes da resposta.",
        body: `<div id="forms-table-host"><p class="placeholder-note">Carregando tabela…</p></div>`,
      })}
    `;
    },
  });
}
