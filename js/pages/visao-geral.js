import { coverageCard } from "../components/coverage-card.mjs";
import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { donut, funnelRows, hBars } from "../components/charts.mjs";
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
    filterNote: "A Visão Geral apresenta a fotografia executiva atual. Séries históricas sem regra temporal comprovada não são exibidas.",
    load: getOverview,
    render: (data) => {
      return `
        ${methodologyBanner(data.methodology || "Indicadores da base oficial do App Pharus. Sem regra definida, o indicador fica pendente.")}
        ${sectionBlock({
          id: "sec-kpis",
          title: "1. Resumo executivo",
          lead: "População oficial, avanço da jornada e utilização dos principais recursos.",
          body: `${renderKpis(data.kpis, 0, 6, "kpi-row-primary")}${renderKpis(data.kpis, 6, 8, "kpi-row-secondary")}`,
        })}
        ${sectionBlock({
          id: "sec-coverage",
          title: "2. Cobertura por recurso",
          lead: "Um cliente pode ter um recurso sem ter o anterior. Os percentuais usam a base oficial como denominador.",
          body: coverageBody(data.coverage),
        })}
        ${sectionBlock({
          id: "sec-journey",
          title: "3. Avanço da jornada",
          body: chartGrid([
            chartCard({ title: "Funil resumido", body: funnelRows(data.journey?.funnel || []), featured: true }),
            chartCard({ title: "Distribuição atual", body: donut(data.journey?.distribution || []) }),
          ]),
        })}
        ${sectionBlock({
          id: "sec-alerts",
          title: "4. Principais alertas",
          lead: "Pontos que merecem acompanhamento operacional.",
          body: hBars((data.alerts || []).map((item) => ({ label: item.label, count: item.value, percent: data.denominator ? (item.value / data.denominator) * 100 : 0 })), { preserveOrder: true }),
        })}
      `;
    },
  });
}
