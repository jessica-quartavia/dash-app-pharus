import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, dualColumns, hBars, monthColumns } from "../components/charts.mjs";
import { openWealthDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getWealthPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatCurrencyExact } from "../utils/format.mjs";

const wealthTable = mountInteractiveTable("wealth-table-host", {
  defaultState: { sortKey: "name", sortDir: "asc" },
  searchPlaceholder: "Buscar cliente",
  title: (rows) => `${rows.length} clientes no recorte`,
  columns: [
    { key: "name", label: "Cliente", sortable: true, value: (row) => escapeHtml(row.name) },
    { key: "total", label: "Patrimônio total", sortable: true, numeric: true, sortValue: (row) => row.wealth?.total || 0, value: (row) => formatCurrencyExact(row.wealth?.total) },
    { key: "investments", label: "Investimentos", sortable: true, numeric: true, sortValue: (row) => row.wealth?.investments || 0, value: (row) => formatCurrencyExact(row.wealth?.investments) },
    { key: "realEstate", label: "Imóveis", sortable: true, numeric: true, sortValue: (row) => row.wealth?.realEstate || 0, value: (row) => formatCurrencyExact(row.wealth?.realEstate) },
    { key: "otherAssets", label: "Outros ativos", sortable: true, numeric: true, sortValue: (row) => row.wealth?.otherAssets || 0, value: (row) => formatCurrencyExact(row.wealth?.otherAssets) },
    { key: "financings", label: "Financiamentos", sortable: true, numeric: true, sortValue: (row) => row.wealth?.financings || 0, value: (row) => formatCurrencyExact(row.wealth?.financings) },
    { key: "loans", label: "Empréstimos", sortable: true, numeric: true, sortValue: (row) => row.wealth?.loans || 0, value: (row) => formatCurrencyExact(row.wealth?.loans) },
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
      ${methodologyBanner("Patrimônio cadastrado no App. Clientes sem cadastro financeiro aparecem como não informado.")}
      ${sectionBlock({
        id: "sec-wealth-kpis",
        title: "1. Resumo patrimonial",
        lead: "Totais, mediana, composição e cobertura da base filtrada.",
        body: kpiRow(data.kpis.slice(0, 4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { featured: true, highlight: kpi.highlight, tooltip: kpi.note })), "kpi-row-primary")
          + kpiRow(data.kpis.slice(4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { compact: true, highlight: kpi.highlight })), "kpi-row-secondary"),
      })}
      ${sectionBlock({
        id: "sec-wealth-charts",
        title: "2. Composição e distribuição",
        lead: "Classes de ativo, faixas e evolução. Passivos entram no saldo devedor e no líquido.",
        body: chartGrid([
          chartCard({ title: "Composição do patrimônio", body: donut(data.composition) }),
          chartCard({ title: "Patrimônio por classe", body: hBars(data.byClass) }),
          chartCard({ title: "Clientes por faixa patrimonial", body: hBars(data.buckets) }),
          chartCard({ title: "Evolução patrimonial", body: monthColumns(data.evolution, { valueKey: "count", format: "currency", maxItems: 6 }) }),
        ]),
      })}
      ${sectionBlock({
        id: "sec-wealth-al",
        title: "3. Ativos e passivos",
        lead: "Leitura da posição agregada — não substitui o balanço oficial do cliente.",
        body: chartCard({
          title: "Ativos x passivos",
          body: dualColumns(data.assetsLiabilities, {
            primaryKey: "assets",
            secondaryKey: "liabilities",
            primaryLabel: "Ativos",
            secondaryLabel: "Passivos",
          }),
        }),
      })}
      ${sectionBlock({
        id: "sec-wealth-table",
        title: "4. Posição por cliente",
        lead: "Clique em um cliente para ver composição e passivos no drawer.",
        body: `<div id="wealth-table-host"><p class="placeholder-note">Carregando tabela…</p></div>`,
      })}
    `;
    },
  });
}
