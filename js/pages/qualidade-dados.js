import { coverageCard } from "../components/coverage-card.mjs";
import { dataTable, tablePanel } from "../components/data-table.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { statusBadge } from "../components/status-badge.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getQualityPage } from "../services/dashboard-service.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { coverageLabel, formatDate, formatNumber, formatPercent } from "../utils/format.mjs";

export function bootQualidade() {
  mountPage({
    pageId: "qualidade",
    filterNote:
      "Cobertura da base oficial do App Pharus. Mecanismos = clientes com pelo menos um mecanismo implementado. O período usa a data de cadastro.",
    load: getQualityPage,
    render: (data) => `
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
        lead: "Com dado, sem dado, cobertura e status lado a lado.",
        body: tablePanel({
          title: "Domínios observados",
          table: dataTable({
            columns: [
              { label: "Domínio", value: (row) => escapeHtml(row.domain) },
              { label: "Fonte", value: (row) => escapeHtml(row.source) },
              { label: "Cobertura", numeric: true, value: (row) => formatPercent(row.percent) },
              { label: "Com dado", numeric: true, value: (row) => formatNumber(row.withData) },
              { label: "Sem dado", numeric: true, value: (row) => formatNumber(row.withoutData) },
              { label: "Atualização", value: (row) => formatDate(row.updatedAt) },
              { label: "Status", value: (row) => statusBadge(coverageLabel(row.tone)) },
            ],
            rows: data.domains,
          }),
        }),
      })}
    `,
  });
}
