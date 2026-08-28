import {
  DOCUMENTED_METRIC_COUNT,
  METRICS_DOCUMENTATION,
  searchMetricsDocumentation,
} from "../data/metrics-documentation.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { escapeHtml } from "../utils/escape.mjs";

function metricBlock(item, pageId) {
  const status = item.status === "pending"
    ? `<span class="doc-status doc-status--pending">Regra ainda em definição</span>`
    : "";
  const example = item.example
    ? `<div class="doc-metric-example"><strong>Exemplo</strong><p>${escapeHtml(item.example)}</p></div>`
    : "";
  return `<article class="doc-metric" data-doc-metric="${escapeHtml(`${pageId}:${item.id}`)}">
    <div class="doc-metric-heading"><h3>${escapeHtml(item.name)}</h3>${status}</div>
    <div class="doc-metric-copy">
      <div><strong>O que significa</strong><p>${escapeHtml(item.meaning)}</p></div>
      <div><strong>Como é calculado</strong><p>${escapeHtml(item.calculation)}</p></div>
      ${example}
    </div>
  </article>`;
}

function documentationSections() {
  return METRICS_DOCUMENTATION.map((item, index) => `
    <section class="doc-section" id="doc-${escapeHtml(item.id)}" data-doc-section="${escapeHtml(item.id)}">
      <div class="doc-section-heading">
        <span>${index + 1}</span>
        <div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.intro)}</p></div>
      </div>
      <div class="doc-metric-list">${item.metrics.map((entry) => metricBlock(entry, item.id)).join("")}</div>
    </section>`).join("");
}

function documentationIndex() {
  return METRICS_DOCUMENTATION.map((item) =>
    `<a href="#documentacao" data-doc-target="doc-${escapeHtml(item.id)}">${escapeHtml(item.title)}</a>`,
  ).join("");
}

function bindDocumentationInteractions() {
  const host = document.getElementById("page-content");
  const input = host?.querySelector("[data-doc-search]");
  const count = host?.querySelector("[data-doc-result-count]");
  if (!host || !input) return;

  const applySearch = () => {
    const matches = searchMetricsDocumentation(input.value);
    const ids = new Set(matches.map((item) => `${item.pageId}:${item.id}`));
    host.querySelectorAll("[data-doc-metric]").forEach((element) => {
      element.hidden = !ids.has(element.dataset.docMetric);
    });
    host.querySelectorAll("[data-doc-section]").forEach((section) => {
      section.hidden = !section.querySelector("[data-doc-metric]:not([hidden])");
    });
    if (count) {
      count.textContent = input.value.trim()
        ? `${matches.length} resultado${matches.length === 1 ? "" : "s"}`
        : `${DOCUMENTED_METRIC_COUNT} métricas documentadas`;
    }
  };

  input.addEventListener("input", applySearch);
  if (host.dataset.docIndexBound !== "true") {
    host.dataset.docIndexBound = "true";
    host.addEventListener("click", (event) => {
      const link = event.target.closest("[data-doc-target]");
      if (!link) return;
      event.preventDefault();
      const target = document.getElementById(link.dataset.docTarget);
      if (!target) return;
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  }
}

export function bootDocumentacao() {
  mountPage({
    pageId: "documentacao",
    load: async () => ({ pages: METRICS_DOCUMENTATION }),
    render: () => {
      queueMicrotask(bindDocumentationInteractions);
      return `
        <section class="doc-tools" aria-label="Ferramentas da documentação">
          <label class="doc-search"><span>Buscar métrica</span><input class="input" type="search" placeholder="Ex.: reunião, patrimônio ou cobertura" data-doc-search /></label>
          <p class="doc-result-count" data-doc-result-count>${DOCUMENTED_METRIC_COUNT} métricas documentadas</p>
          <nav class="doc-index" aria-label="Índice da documentação">${documentationIndex()}</nav>
        </section>
        <div class="doc-sections">${documentationSections()}</div>
      `;
    },
  });
}
