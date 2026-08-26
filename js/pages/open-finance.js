import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, dualColumns, hBars, monthColumns } from "../components/charts.mjs";
import { dataTable, tablePanel } from "../components/data-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { statusBadge } from "../components/status-badge.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getOpenFinancePage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDateTime, formatNumber } from "../utils/format.mjs";

export function bootOpenFinance() {
  mountPage({
    pageId: "open_finance",
    load: getOpenFinancePage,
    render: (data) => `
      ${methodologyBanner("Saúde das integrações usa o status da última sincronização de demonstração.")}
      ${sectionBlock({
        id: "sec-of-kpis",
        title: "1. Resumo das conexões",
        lead: "Clientes conectados, contas e qualidade da sincronização.",
        body: kpiRow(data.kpis.slice(0, 4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { featured: true, tooltip: kpi.note })), "kpi-row-primary")
          + kpiRow(data.kpis.slice(4).map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { compact: true })), "kpi-row-secondary"),
      })}
      ${sectionBlock({
        id: "sec-of-health",
        title: "2. Saúde das integrações",
        lead: "Saudável, atenção ou falha — a falha não é escondida.",
        body: `<div class="health-grid">
          <article class="health-card"><p class="eyebrow">Saudável</p><p class="count">${formatNumber(data.health.Saudável)}</p><p class="note-muted">Sincronização útil</p></article>
          <article class="health-card"><p class="eyebrow">Atenção</p><p class="count">${formatNumber(data.health.Atenção)}</p><p class="note-muted">Sucesso parcial</p></article>
          <article class="health-card"><p class="eyebrow">Falha</p><p class="count">${formatNumber(data.health.Falha)}</p><p class="note-muted">Sem dado confiável</p></article>
        </div>`,
      })}
      ${sectionBlock({
        id: "sec-of-charts",
        title: "3. Evolução e composição",
        body: chartGrid([
          chartCard({ title: "Evolução das conexões", body: monthColumns(data.monthly.map((item) => ({ month: item.month, count: item.connections }))) }),
          chartCard({ title: "Status das conexões", body: donut(data.status) }),
          chartCard({ title: "Instituições conectadas", body: hBars(data.institutions) }),
          chartCard({ title: "Contas por tipo", body: hBars(data.accountTypes.filter((item) => item.count > 0)) }),
          chartCard({
            title: "Receitas x despesas",
            body: dualColumns(data.cashflow, {
              primaryKey: "income",
              secondaryKey: "expense",
              primaryLabel: "Receitas",
              secondaryLabel: "Despesas",
            }),
          }),
          chartCard({ title: "Despesas por categoria", subtitle: "Não informado aparece por último", body: hBars(data.expenses) }),
        ]),
      })}
      ${sectionBlock({
        id: "sec-of-table",
        title: "4. Conexões",
        body: tablePanel({
          title: "Situação por cliente e instituição",
          table: dataTable({
            columns: [
              { label: "Cliente", value: (row) => escapeHtml(row.clientName) },
              { label: "Instituição", value: (row) => escapeHtml(row.institution) },
              { label: "Status", value: (row) => statusBadge(row.result) },
              { label: "Contas", numeric: true, value: (row) => formatNumber(row.accounts) },
              { label: "Última sincronização", value: (row) => formatDateTime(row.lastSyncAt) },
              { label: "Situação", value: (row) => statusBadge(row.health) },
            ],
            rows: data.rows,
          }),
        }),
      })}
    `,
  });
}
