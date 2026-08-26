import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, hBars, monthColumns } from "../components/charts.mjs";
import { dataTable, tablePanel } from "../components/data-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { statusBadge } from "../components/status-badge.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getFormsPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatPercent } from "../utils/format.mjs";

export function bootFormularios() {
  mountPage({
    pageId: "formularios",
    load: getFormsPage,
    render: (data) => `
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
        body: tablePanel({
          title: "Status por cliente e formulário",
          table: dataTable({
            columns: [
              { label: "Cliente", value: (row) => escapeHtml(row.clientName) },
              { label: "Formulário", value: (row) => escapeHtml(row.formName) },
              { label: "Status", value: (row) => statusBadge(row.status) },
              { label: "Data de início", value: (row) => formatDate(row.startedAt) },
              { label: "Data de conclusão", value: (row) => formatDate(row.completedAt) },
              { label: "Progresso", numeric: true, value: (row) => formatPercent(row.progress) },
            ],
            rows: data.rows,
          }),
        }),
      })}
    `,
  });
}
