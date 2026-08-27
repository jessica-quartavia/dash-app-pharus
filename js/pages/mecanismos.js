import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, hBars, monthColumns } from "../components/charts.mjs";
import { openMechanismDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getMechanismsPage } from "../services/app-pharus/mechanisms.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatNumber } from "../utils/format.mjs";

const KPI_ROW_PRIMARY = ["with", "implementations", "coverage", "available"];
const KPI_ROW_SECONDARY = ["average", "without", "last"];

import { advisorField, periodField, searchField } from "../lib/filters/contracts.mjs";

const clientTable = mountInteractiveTable("mech-client-table-host", {
  defaultState: { sortKey: "mechanismsImplemented", sortDir: "desc" },
  hideSearch: true,
  title: (rows) => `${formatNumber(rows.length)} clientes no recorte`,
  columns: [
    {
      key: "name",
      label: "Cliente",
      sortable: true,
      sortValue: (row) => String(row.name || "").toLowerCase(),
      value: (row) =>
        `<strong>${escapeHtml(row.name)}</strong><div class="text-muted">${escapeHtml(row.email || row.id)}</div>`,
    },
    {
      key: "mechanismsImplemented",
      label: "Implementados",
      sortable: true,
      numeric: true,
      value: (row) => formatNumber(row.mechanismsImplemented),
    },
    {
      key: "firstMechanismAt",
      label: "Primeiro mecanismo",
      sortable: true,
      value: (row) => formatDate(row.firstMechanismAt),
    },
    {
      key: "lastMechanismAt",
      label: "Último mecanismo",
      sortable: true,
      value: (row) => formatDate(row.lastMechanismAt),
    },
  ],
  onRowClick: (client) => openMechanismDrawer(client),
});

function renderMechanismKpis(kpis) {
  const byKey = Object.fromEntries(kpis.map((kpi) => [kpi.key, kpi]));
  return (
    kpiRow(
      KPI_ROW_PRIMARY.map((key) => {
        const kpi = byKey[key];
        if (!kpi) return "";
        return kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, {
          featured: true,
          highlight: Boolean(kpi.primary),
          tooltip: kpi.note,
        });
      }).filter(Boolean),
      "kpi-row-primary",
    ) +
    kpiRow(
      KPI_ROW_SECONDARY.map((key) => {
        const kpi = byKey[key];
        if (!kpi) return "";
        return kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, {
          compact: true,
          tooltip: kpi.note,
        });
      }).filter(Boolean),
      "kpi-row-secondary kpi-row-3",
    )
  );
}

export function bootMecanismos() {
  mountPage({
    pageId: "mecanismos",
    filterNote:
      "O período usa a data de cadastro. Responsável / EP filtra clientes alocados em backoffice.internals_customers_allocations.",
    load: getMechanismsPage,
    resolveFields: (data) => [searchField(), periodField(), advisorField(data?.advisors || [])],
    render: (data) => {
      queueMicrotask(() => clientTable.mount({ rows: data.rows || [] }));
      return `
        ${methodologyBanner(data.methodology || "Mecanismos implementados na base oficial do App Pharus.")}
        ${sectionBlock({
          id: "sec-mech-kpis",
          title: "1. Resumo de implementação",
          body: renderMechanismKpis(data.kpis),
        })}
        ${sectionBlock({
          id: "sec-mech-charts",
          title: "2. Quais mecanismos avançam",
          body: chartGrid([
            chartCard({ title: "Mecanismos mais implementados", body: hBars(data.byMechanism) }),
            chartCard({ title: "Implementação por categoria", body: donut(data.byCategory) }),
            chartCard({ title: "Evolução mensal", body: monthColumns(data.monthly, { titleSuffix: "implementações", maxItems: 6 }) }),
            chartCard({ title: "Quantidade por cliente", body: hBars(data.qtyDist, { preserveOrder: true }) }),
          ]),
        })}
        ${sectionBlock({
          id: "sec-mech-table",
          title: "3. Implementação por cliente",
          lead: "Use a busca na barra de filtros. Clique em um cliente para ver os mecanismos implementados.",
          body: `<div id="mech-client-table-host"><p class="placeholder-note">Carregando tabela…</p></div>`,
        })}
      `;
    },
  });
}
