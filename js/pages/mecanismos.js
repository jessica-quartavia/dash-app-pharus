import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, hBars, monthColumns } from "../components/charts.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { openMechanismDrawer } from "../components/mechanism-drawer.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import {
  bindMechanismsClientTable,
  defaultMechanismsTableState,
  renderMechanismsClientTable,
} from "../lib/mechanisms-table.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getMechanismsPage } from "../services/app-pharus/mechanisms.mjs";

const KPI_ROW_PRIMARY = ["with", "implementations", "coverage", "available"];
const KPI_ROW_SECONDARY = ["average", "without", "last"];

let tableRows = [];
let tableState = defaultMechanismsTableState();

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

function mountClientTable(data) {
  tableRows = data.rows || [];
  tableState = defaultMechanismsTableState();
  const host = document.getElementById("mech-client-table-host");
  if (!host) return;
  host.innerHTML = renderMechanismsClientTable(tableRows, tableState, {
    recorteTotal: data.recorteTotal,
    officialTotal: data.officialTotal,
  });
  bindMechanismsClientTable(host, tableRows, tableState, {
    onRowClick: (client) => openMechanismDrawer(client),
  });
}

export function bootMecanismos() {
  mountPage({
    pageId: "mecanismos",
    filterNote:
      "O período usa a data de cadastro. Responsável / EP filtra quando houver vínculo cadastrado. Os indicadores são recalculados sobre a população oficial do recorte.",
    load: getMechanismsPage,
    render: (data) => {
      queueMicrotask(() => mountClientTable(data));
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
          lead: "Clique em um cliente para ver os mecanismos implementados.",
          body: `<div id="mech-client-table-host"><p class="placeholder-note">Carregando tabela…</p></div>`,
        })}
      `;
    },
  });
}
