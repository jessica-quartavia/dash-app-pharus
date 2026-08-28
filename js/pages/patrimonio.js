import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, hBars } from "../components/charts.mjs";
import { openWealthDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getWealthPage } from "../services/app-pharus/domain-pages.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatCurrencyExact } from "../utils/format.mjs";

const wealthTable = mountInteractiveTable("wealth-table-host", {
  defaultState: { sortKey: "assets", sortDir: "desc" },
  title: (rows) => `${rows.length} clientes no recorte`,
  columns: [
    { key: "name", label: "Cliente", sortable: true, value: (row) => escapeHtml(row.name) },
    { key: "assets", label: "Ativos", sortable: true, numeric: true, sortValue: (row) => row.wealth?.assets || 0, value: (row) => formatCurrencyExact(row.wealth?.assets) },
    { key: "liabilities", label: "Passivos", sortable: true, numeric: true, sortValue: (row) => row.wealth?.liabilities || 0, value: (row) => formatCurrencyExact(row.wealth?.liabilities) },
    { key: "net", label: "Patrimônio líquido", sortable: true, numeric: true, sortValue: (row) => row.wealth?.net || 0, value: (row) => formatCurrencyExact(row.wealth?.net) },
  ],
  onRowClick: (row) => openWealthDrawer(row),
});

export function bootPatrimonio() {
  mountPage({
    pageId: "patrimonio",
    load: getWealthPage,
    render: (data) => {
      queueMicrotask(() => wealthTable.mount({ rows: data.rows || [] }));
      return `
        ${methodologyBanner("Patrimônio líquido = ativos cadastrados menos saldo devedor.", data.completenessRule)}
        ${sectionBlock({
          id: "sec-wealth-kpis",
          title: "1. Resumo patrimonial",
          lead: "Valores atuais das fontes financeiras comprovadas no App Pharus.",
          body: kpiRow(data.kpis.slice(0, 4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { featured: true, tooltip: kpi.note })), "kpi-row-primary") + kpiRow(data.kpis.slice(4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { compact: true })), "kpi-row-secondary"),
        })}
        ${sectionBlock({
          id: "sec-wealth-charts",
          title: "2. Composição e completude",
          body: chartGrid([
            chartCard({ title: "Composição dos ativos", body: donut(data.composition) }),
            chartCard({ title: "Passivos por classe", body: hBars(data.liabilities) }),
            chartCard({ title: "Completude de dados financeiros", subtitle: "Ativos/Investimentos + Dívidas + Open Finance", body: donut(data.completeness) }),
          ]),
        })}
        ${sectionBlock({ id: "sec-wealth-rule", title: "3. Critério de completude", body: `<p class="note-muted">${escapeHtml(data.completenessRule)}</p>` })}
        ${sectionBlock({ id: "sec-wealth-table", title: "4. Posição por cliente", lead: "Clique em um cliente para ver ativos e passivos no drawer.", body: `<div id="wealth-table-host"><p class="placeholder-note">Carregando tabela…</p></div>` })}
      `;
    },
  });
}
