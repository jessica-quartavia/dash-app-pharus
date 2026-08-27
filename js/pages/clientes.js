import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { hBars } from "../components/charts.mjs";
import { openClientDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { tierBadge, yesNoBadge } from "../components/status-badge.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getClientsPage } from "../services/app-pharus/clients.mjs";
import { formatDate, formatNumber } from "../utils/format.mjs";
import { escapeHtml } from "../utils/escape.mjs";

const clientTable = mountInteractiveTable("client-table-host", {
  defaultState: { sortKey: "name", sortDir: "asc" },
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
      key: "tier",
      label: "Segmento",
      sortable: true,
      sortValue: (row) => String(row.tier || ""),
      value: (row) => tierBadge(row.tier, row.isDebts),
    },
    {
      key: "registeredAt",
      label: "Data de cadastro",
      sortable: true,
      value: (row) => formatDate(row.registeredAt),
    },
    {
      key: "hasWealth",
      label: "Patrimônio",
      sortable: true,
      sortValue: (row) => (row.hasWealth ? 1 : 0),
      value: (row) => yesNoBadge(row.hasWealth),
    },
    {
      key: "hasOpenFinance",
      label: "Open Finance",
      sortable: true,
      sortValue: (row) => (row.hasOpenFinance ? 1 : 0),
      value: (row) => yesNoBadge(row.hasOpenFinance),
    },
    {
      key: "hasMechanisms",
      label: "Mecanismos",
      sortable: true,
      sortValue: (row) => (row.hasMechanisms ? 1 : 0),
      value: (row) => yesNoBadge(row.hasMechanisms),
    },
    {
      key: "hasMeetings",
      label: "Reuniões",
      sortable: true,
      sortValue: (row) => (row.hasMeetings ? 1 : 0),
      value: (row) => yesNoBadge(row.hasMeetings),
    },
    {
      key: "journeyStage",
      label: "Estágio da jornada",
      sortable: true,
      value: (row) => escapeHtml(row.journeyStage || "Não informado"),
    },
  ],
  onRowClick: (client) => openClientDrawer(client),
});

function renderKpis(kpis) {
  const primaryKeys = ["total", "active", "new", "onboarding", "personal_data"];
  const secondaryKeys = ["inactive"];
  const primary = kpis.filter((kpi) => primaryKeys.includes(kpi.key));
  const secondary = kpis.filter((kpi) => secondaryKeys.includes(kpi.key));
  return (
    kpiRow(
      primary.map((kpi) =>
        kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, {
          featured: true,
          tooltip: kpi.note,
        }),
      ),
      "kpi-row-primary",
    ) +
    (secondary.length
      ? kpiRow(
          secondary.map((kpi) =>
            kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, {
              compact: true,
              tooltip: kpi.note,
            }),
          ),
          "kpi-row-secondary",
        )
      : "")
  );
}

function segmentChartBody(items) {
  const ordered = [...(items || [])].sort((a, b) => {
    if (a.label === "Dados insuficientes") return 1;
    if (b.label === "Dados insuficientes") return -1;
    return 0;
  });
  return hBars(ordered, { preserveOrder: true });
}

export function bootClientes() {
  mountPage({
    pageId: "clientes",
    filterNote:
      "Busca, Open Finance, mecanismos, patrimônio, jornada e segmento filtram a base oficial. O período usa a data de cadastro.",
    load: getClientsPage,
    render: (data) => {
      queueMicrotask(() => clientTable.mount({ rows: data.rows }));
      return `
        ${methodologyBanner(data.methodology || "Base oficial do App Pharus.")}
        ${sectionBlock({
          id: "sec-client-kpis",
          title: "1. Resumo da base",
          lead: "Indicadores calculados sobre o mesmo recorte filtrado da tabela.",
          body: renderKpis(data.kpis),
        })}
        ${sectionBlock({
          id: "sec-client-segment",
          title: "2. Clientes por segmento",
          lead: "Classificação Tier via core.user_engines (renda, reserva, aporte). DEBTS permanece pendente de regra oficial.",
          body: segmentChartBody(data.segmentChart),
        })}
        ${sectionBlock({
          id: "sec-client-table",
          title: "3. Clientes",
          lead: "Use a busca na barra de filtros. Clique em um cliente para abrir a visão 360.",
          body: `<div id="client-table-host"><p class="placeholder-note">Carregando tabela…</p></div>`,
        })}
      `;
    },
  });
}
