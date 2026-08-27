import { coverageCard } from "../components/coverage-card.mjs";
import { openQualityDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { statusBadge } from "../components/status-badge.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getQualityPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { coverageLabel, formatDate, formatNumber, formatPercent } from "../utils/format.mjs";

const qualityTable = mountInteractiveTable("quality-table-host", {
  defaultState: { sortKey: "domain", sortDir: "asc" },
  searchPlaceholder: "Buscar domínio",
  title: (rows) => `${rows.length} domínios`,
  rowIdKey: "id",
  columns: [
    { key: "domain", label: "Domínio", sortable: true, value: (row) => escapeHtml(row.domain) },
    { key: "source", label: "Fonte", sortable: true, value: (row) => escapeHtml(row.source) },
    { key: "percent", label: "Cobertura", sortable: true, numeric: true, sortValue: (row) => row.percent ?? 0, value: (row) => formatPercent(row.percent) },
    { key: "withData", label: "Com dado", sortable: true, numeric: true, value: (row) => formatNumber(row.withData) },
    { key: "withoutData", label: "Sem dado", sortable: true, numeric: true, value: (row) => formatNumber(row.withoutData) },
    { key: "updatedAt", label: "Atualização", sortable: true, value: (row) => formatDate(row.updatedAt) },
    { key: "tone", label: "Status", sortable: true, value: (row) => statusBadge(coverageLabel(row.tone)) },
  ],
  onRowClick: (row) => openQualityDrawer(row),
});

export function bootQualidade() {
  mountPage({
    pageId: "qualidade",
    filterNote:
      "Cobertura da base oficial do App Pharus. Mecanismos = clientes com pelo menos um mecanismo implementado. O período usa a data de cadastro.",
    load: getQualityPage,
    render: (data) => {
      queueMicrotask(() => qualityTable.mount({ rows: data.domains || [] }));
      return `
      ${methodologyBanner("A ausência de informação aparece explicitamente. Nenhum domínio sem dado é ocultado.")}
      ${sectionBlock({
        id: "sec-quality-cards",
        title: "1. Cobertura por domínio",
        lead: `Base do recorte: ${formatNumber(data.total)} clientes. Boa, atenção ou crítica conforme o percentual com dado.`,
        body: `<div class="coverage-grid">${data.domains.map((item) => coverageCard({ label: item.domain, ...item })).join("")}</div>`,
      })}
      ${sectionBlock({
        id: "sec-quality-table",
        title: "2. Detalhe da qualidade",
        lead: "Clique em um domínio para ver detalhes. Paginação padrão: 25 registros.",
        body: `<div id="quality-table-host"><p class="placeholder-note">Carregando tabela…</p></div>`,
      })}
    `;
    },
  });
}
