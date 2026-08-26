import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { funnelRows, hBars } from "../components/charts.mjs";
import { dataTable, tablePanel } from "../components/data-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getJourneyPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatNumber, formatPercent } from "../utils/format.mjs";

export function bootJornada() {
  mountPage({
    pageId: "jornada",
    load: getJourneyPage,
    render: (data) => `
      ${methodologyBanner("Estágio atual do App. Abandono = maior perda absoluta entre etapas consecutivas.")}
      ${sectionBlock({
        id: "sec-journey-kpis",
        title: "1. Resumo da jornada",
        body: kpiRow(data.kpis.slice(0, 3).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { featured: true, tooltip: kpi.note })), "kpi-row-primary")
          + kpiRow(data.kpis.slice(3).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { compact: true })), "kpi-row-secondary"),
      })}
      ${sectionBlock({
        id: "sec-journey-funnel",
        title: "2. Funil da jornada",
        body: chartGrid([
          chartCard({ title: "Clientes por etapa", body: funnelRows(data.funnel), featured: true }),
          chartCard({ title: "Taxa de avanço entre etapas", subtitle: "Quem chegou na etapa seguinte", body: hBars(data.advance) }),
        ]),
      })}
      ${sectionBlock({
        id: "sec-journey-table",
        title: "3. Posição por cliente",
        body: tablePanel({
          title: "Estágio atual",
          table: dataTable({
            columns: [
              { label: "Cliente", value: (row) => escapeHtml(row.name) },
              { label: "Etapa atual", value: (row) => escapeHtml(row.journeyStage || "Não informado") },
              { label: "Progresso", numeric: true, value: (row) => formatPercent(row.journeyProgress) },
              { label: "Data de início", value: (row) => formatDate(row.journeyStartedAt) },
              { label: "Última atividade", value: (row) => formatDate(row.lastActivityAt) },
              { label: "Tempo na etapa", numeric: true, value: (row) => (row.daysInStage == null ? "—" : `${formatNumber(row.daysInStage)} dias`) },
            ],
            rows: data.rows,
          }),
        }),
      })}
    `,
  });
}
