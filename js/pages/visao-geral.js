import { coverageCard } from "../components/coverage-card.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getOverview } from "../services/app-pharus/overview.mjs";
import { escapeHtml } from "../utils/escape.mjs";

function renderKpis(kpis, start, end, variant) {
  return kpiRow(
    kpis.slice(start, end).map((kpi) =>
      kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, {
        featured: variant === "kpi-row-primary",
        compact: variant === "kpi-row-secondary",
        tooltip: kpi.note,
      }),
    ),
    variant,
  );
}

function coverageBody(items) {
  if (!items?.length) {
    return `<p class="placeholder-note">Sem cobertura calculável enquanto a base oficial de clientes não estiver disponível.</p>`;
  }
  return `<div class="coverage-grid">${items
    .map((item) => {
      if (item.status !== "ok") {
        return `<article class="coverage-card">
          <h3>${escapeHtml(item.label)}</h3>
          <p class="kpi-note">${escapeHtml(item.note || "Dados indisponíveis ou regra pendente.")}</p>
        </article>`;
      }
      return coverageCard(item);
    })
    .join("")}</div>`;
}

export function bootVisaoGeral() {
  mountPage({
    pageId: "visao_geral",
    filterNote: "O filtro de período ainda não altera esta página: não há recorte mensal único de utilização do App.",
    load: getOverview,
    render: (data) => {
      const monthly = `<div class="gd-status" role="status"><strong>Indicador em definição</strong><span>${escapeHtml(data.monthly?.message || "Ainda não há série mensal de utilização.")}</span></div>`;

      return `
        ${methodologyBanner(data.methodology || "Indicadores da base oficial do App Pharus. Sem regra definida, o indicador fica pendente.")}
        ${sectionBlock({
          id: "sec-kpis",
          title: "1. Resumo de utilização",
          lead: "Somente indicadores com regra definida. Os demais aparecem como regra pendente.",
          body: `${renderKpis(data.kpis, 0, 4, "kpi-row-primary")}${renderKpis(data.kpis, 4, 8, "kpi-row-secondary")}`,
        })}
        ${sectionBlock({
          id: "sec-coverage",
          title: "2. Cobertura por recurso",
          lead: "Um cliente pode ter um recurso sem ter o anterior. Os percentuais usam a base oficial como denominador.",
          body: coverageBody(data.coverage),
        })}
        ${sectionBlock({
          id: "sec-monthly",
          title: "3. Evolução mensal",
          lead: "A série de utilização do App ainda está em definição.",
          body: monthly,
        })}
        ${sectionBlock({
          id: "sec-insights",
          title: "4. Insights",
          lead: "O espaço permanece preparado para análises futuras.",
          body: `<p class="placeholder-note">Nenhum insight gerado nesta etapa.</p>`,
        })}
      `;
    },
  });
}
