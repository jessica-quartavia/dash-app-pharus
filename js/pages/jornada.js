import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { funnelRows, hBars } from "../components/charts.mjs";
import { openJourneyDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getJourneyPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatNumber, formatPercent } from "../utils/format.mjs";

const journeyTable = mountInteractiveTable("journey-table-host", {
  defaultState: { sortKey: "name", sortDir: "asc" },
  searchPlaceholder: "Buscar cliente ou etapa",
  title: (rows) => `${rows.length} clientes`,
  columns: [
    { key: "name", label: "Cliente", sortable: true, value: (row) => escapeHtml(row.name) },
    { key: "journeyStage", label: "Etapa atual", sortable: true, value: (row) => escapeHtml(row.journeyStage || "Não informado") },
    { key: "journeyProgress", label: "Progresso", sortable: true, numeric: true, sortValue: (row) => row.journeyProgress ?? 0, value: (row) => formatPercent(row.journeyProgress) },
    { key: "journeyStartedAt", label: "Data de início", sortable: true, value: (row) => formatDate(row.journeyStartedAt) },
    { key: "lastActivityAt", label: "Última atividade", sortable: true, value: (row) => formatDate(row.lastActivityAt) },
    { key: "daysInStage", label: "Tempo na etapa", sortable: true, numeric: true, sortValue: (row) => row.daysInStage ?? -1, value: (row) => (row.daysInStage == null ? "—" : `${formatNumber(row.daysInStage)} dias`) },
  ],
  onRowClick: (row) => openJourneyDrawer(row),
});

export function bootJornada() {
  mountPage({
    pageId: "jornada",
    load: getJourneyPage,
    render: (data) => {
      queueMicrotask(() => journeyTable.mount({ rows: data.rows || [] }));
      return `
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
        lead: "Clique em um cliente para ver histórico resumido da jornada.",
        body: `<div id="journey-table-host"><p class="placeholder-note">Carregando tabela…</p></div>`,
      })}
    `;
    },
  });
}
