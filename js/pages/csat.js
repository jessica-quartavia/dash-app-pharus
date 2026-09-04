import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { bindUsageLineChartTooltips, csatScoreLine, hBars, monthColumns } from "../components/charts.mjs";
import { openCsatDrawer } from "../components/domain-drawers.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { sectionEmpty } from "../components/skeleton.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { advisorField, originField, periodField, ratingField, screenField, searchField } from "../lib/filters/contracts.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatDecimal, formatNumber } from "../utils/format.mjs";

function starMeter(score) {
  if (score == null) return "—";
  const n = Math.max(0, Math.min(5, Math.round(Number(score))));
  return `<span class="csat-stars" aria-label="${n} de 5">${"★".repeat(n)}${"☆".repeat(5 - n)}</span><span class="csat-star-value">${escapeHtml(formatDecimal(score, { digits: 1 }))}</span>`;
}

function distBars(distribution) {
  return hBars(
    (distribution || []).map((item) => ({ label: item.label, count: item.count, percent: item.percent })),
    { preserveOrder: true, compact: true },
  );
}

function tagList(items, emptyText) {
  if (!items?.length) return sectionEmpty(emptyText);
  return hBars(items, { compact: true, initialLimit: 8 });
}

function screenRanking(items) {
  if (!items?.length) return sectionEmpty("Sem avaliações por tela neste recorte.");
  return `<div class="csat-rank-table" role="table">
    <div class="csat-rank-head" role="row">
      <span role="columnheader">Tela</span>
      <span role="columnheader">Nota</span>
      <span role="columnheader">Avaliações</span>
    </div>
    ${items.map((item) => `
      <div class="csat-rank-row" role="row">
        <span role="cell">${escapeHtml(item.label)}</span>
        <span role="cell">${item.average == null ? "—" : escapeHtml(formatDecimal(item.average, { digits: 1 }))}</span>
        <span role="cell">${formatNumber(item.count)}</span>
      </div>
    `).join("")}
  </div>`;
}

const feedbackTable = mountInteractiveTable("csat-feedback-table-host", {
  defaultState: { sortKey: "createdAt", sortDir: "desc", pageSize: 25 },
  rowIdKey: "id",
  title: (rows) => `${formatNumber(rows.length)} feedbacks`,
  columns: [
    { key: "clientName", label: "Cliente", sortable: true, value: (row) => escapeHtml(row.clientName || "—") },
    { key: "originLabel", label: "Origem", sortable: true, value: (row) => escapeHtml(row.originLabel) },
    { key: "subject", label: "Tela / Reunião", sortable: true, value: (row) => escapeHtml(row.subject || "—") },
    {
      key: "score",
      label: "Nota",
      sortable: true,
      numeric: true,
      sortValue: (row) => row.score ?? -1,
      value: (row) => (row.score == null ? "—" : `${starMeter(row.score)}`),
    },
    { key: "comment", label: "Feedback", value: (row) => escapeHtml((row.comment || row.positivePoints?.[0] || row.improvementPoints?.[0] || "—")) },
    { key: "createdAt", label: "Data", sortable: true, value: (row) => formatDate(row.createdAt) },
    { key: "advisor", label: "EP", sortable: true, value: (row) => escapeHtml(row.advisor || "—") },
  ],
  onRowClick: (row) => openCsatDrawer(row),
});

function kpisHtml(kpis) {
  const featured = (kpis || []).slice(0, 4).map((kpi) =>
    kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { featured: true, tooltip: kpi.note }),
  );
  const rest = (kpis || []).slice(4).map((kpi) =>
    kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { compact: true, tooltip: kpi.note }),
  );
  return `${kpiRow(featured, "kpi-row-primary")}${rest.length ? kpiRow(rest, "kpi-row-secondary") : ""}`;
}

export function renderCsatPage(data = {}) {
  const origin = data.filters?.origin || "all";
  const showMeetings = origin !== "platform";
  const showPlatform = origin !== "meetings";
  const notices = (data.notices || []).map((text) => `<p class="csat-notice">${escapeHtml(text)}</p>`).join("");

  return `
    ${methodologyBanner("O CSAT reúne duas pesquisas diferentes: avaliações depois das reuniões e feedbacks das telas do Pharus. As notas não são comparadas como se fossem a mesma experiência.")}
    ${notices}
    ${sectionBlock({
      id: "sec-csat-overview",
      title: "1. Visão geral do CSAT",
      body: `
        ${kpisHtml(data.kpis || [])}
        <div class="csat-origin-grid">
          ${(data.originCards || []).map((card) => `
            <article class="csat-origin-card">
              <p class="csat-origin-label">${escapeHtml(card.label)}</p>
              <p class="csat-origin-score">${card.average == null ? "—" : starMeter(card.average)}</p>
              <p class="csat-origin-meta">${formatNumber(card.evaluations)} avaliações</p>
            </article>
          `).join("")}
        </div>
        <p class="note-muted">Reuniões e plataforma são contextos diferentes. A nota maior em um lado não significa que a outra experiência seja pior.</p>
      `,
    })}
    ${showMeetings ? sectionBlock({
      id: "sec-csat-meetings",
      title: "2. CSAT das Reuniões",
      lead: "Fonte: avaliações registradas depois das reuniões.",
      body: data.meetings?.evaluations
        ? chartGrid([
            chartCard({ title: "Distribuição das avaliações", body: distBars(data.meetings.distribution) }),
            chartCard({ title: "Evolução da nota", subtitle: "Média mensal das reuniões", body: csatScoreLine(data.meetings.trend) }),
            chartCard({ title: "Avaliações por mês", subtitle: "Volume de respostas", body: monthColumns(data.meetings.trend, { valueKey: "count", titleSuffix: "avaliações" }) }),
            chartCard({ title: "Pontos positivos", body: tagList(data.meetings.positivePoints, "Nenhum ponto positivo neste recorte.") }),
            chartCard({ title: "Pontos de melhoria", body: tagList(data.meetings.improvementPoints, "Nenhum ponto de melhoria neste recorte.") }),
            chartCard({ title: "Por tipo de reunião", body: hBars((data.meetings.byType || []).map((item) => ({ label: `${item.label} · ${formatDecimal(item.average, { digits: 1 })}`, count: item.count, percent: item.percent })), { compact: true }) }),
            chartCard({ title: "Por responsável / EP", body: hBars((data.meetings.byAdvisor || []).map((item) => ({ label: item.label, count: item.count, percent: item.percent })), { compact: true }) }),
          ])
        : sectionEmpty("Sem avaliações de reunião neste recorte."),
    }) : ""}
    ${showPlatform ? sectionBlock({
      id: showMeetings ? "sec-csat-platform" : "sec-csat-platform",
      title: showMeetings ? "3. CSAT da Plataforma" : "2. CSAT da Plataforma",
      lead: "Fonte: feedbacks enviados nas telas do Pharus.",
      body: data.platform?.evaluations
        ? chartGrid([
            chartCard({ title: "Distribuição das avaliações", body: distBars(data.platform.distribution) }),
            chartCard({ title: "Evolução da nota", subtitle: "Média mensal da plataforma", body: csatScoreLine(data.platform.trend) }),
            chartCard({ title: "CSAT por tela", body: screenRanking(data.platform.byScreen) }),
            chartCard({ title: "Telas com pontos de melhoria", body: tagList(data.platform.byScreenImprovement, "Nenhuma tela com pontos de melhoria neste recorte.") }),
            chartCard({ title: "Pontos positivos", body: tagList(data.platform.positivePoints, "Nenhum ponto positivo neste recorte.") }),
            chartCard({ title: "Pontos de melhoria", body: tagList(data.platform.improvementPoints, "Nenhum ponto de melhoria neste recorte.") }),
            chartCard({ title: "Avaliações por mês", subtitle: "Volume de respostas", body: monthColumns(data.platform.trend, { valueKey: "count", titleSuffix: "avaliações" }) }),
          ])
        : sectionEmpty("Sem feedbacks da plataforma neste recorte."),
    }) : ""}
    ${sectionBlock({
      id: "sec-csat-table",
      title: `${showMeetings && showPlatform ? "4" : "3"}. Feedbacks`,
      lead: "Clique em uma avaliação para ver os detalhes.",
      body: `<div id="csat-feedback-table-host"><p class="placeholder-note">Carregando tabela…</p></div>`,
    })}
  `;
}

export function bootCsat() {
  mountPage({
    pageId: "csat",
    filterNote: "Período, origem, nota, tela e responsável valem para todos os indicadores desta página.",
    resolveFields: (data) => [
      searchField(),
      periodField(),
      originField(),
      ratingField(),
      screenField(data.screens || []),
      advisorField(data.advisors || []),
    ],
    load: (filters, options) => import("../services/app-pharus/csat.mjs").then((m) => m.getCsatPage(filters, options)),
    render: (data) => {
      queueMicrotask(() => {
        feedbackTable.mount({ rows: data.rows || [] });
        bindUsageLineChartTooltips(document.getElementById("page-content") || document);
      });
      return renderCsatPage(data);
    },
  });
}
