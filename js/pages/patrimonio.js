import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, dualColumns, hBars, monthColumns } from "../components/charts.mjs";
import { dataTable, tablePanel } from "../components/data-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getWealthPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatCurrencyExact } from "../utils/format.mjs";

export function bootPatrimonio() {
  mountPage({
    pageId: "patrimonio",
    load: getWealthPage,
    render: (data) => `
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
        lead: "Clientes sem patrimônio continuam listados quando o recorte não exige cadastro financeiro.",
        body: tablePanel({
          title: "Posição cadastrada",
          table: dataTable({
            columns: [
              { label: "Cliente", value: (row) => escapeHtml(row.name) },
              { label: "Patrimônio total", numeric: true, value: (row) => formatCurrencyExact(row.wealth?.total) },
              { label: "Investimentos", numeric: true, value: (row) => formatCurrencyExact(row.wealth?.investments) },
              { label: "Imóveis", numeric: true, value: (row) => formatCurrencyExact(row.wealth?.realEstate) },
              { label: "Outros ativos", numeric: true, value: (row) => formatCurrencyExact(row.wealth?.otherAssets) },
              { label: "Financiamentos", numeric: true, value: (row) => formatCurrencyExact(row.wealth?.financings) },
              { label: "Empréstimos", numeric: true, value: (row) => formatCurrencyExact(row.wealth?.loans) },
              { label: "Patrimônio líquido", numeric: true, value: (row) => formatCurrencyExact(row.wealth?.net) },
            ],
            rows: data.rows,
          }),
        }),
      })}
    `,
  });
}
