import { escapeHtml } from "../utils/escape.mjs";

function times(count, render) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => render(index)).join("");
}

export function skeletonLine({ width = "64%" } = {}) {
  return `<span class="ui-skeleton ui-skeleton-line" style="width:${escapeHtml(String(width))}"></span>`;
}

export function skeletonKpi({ featured = false } = {}) {
  return `<article class="app-usage-kpi${featured ? " is-featured" : ""} is-skeleton" aria-hidden="true">
    <div class="app-usage-kpi-head">${skeletonLine({ width: "42%" })}</div>
    <div class="app-usage-kpi-value"><span class="ui-skeleton ui-skeleton-value"></span></div>
    <div class="app-usage-kpi-description">${skeletonLine({ width: "72%" })}</div>
  </article>`;
}

export function skeletonKpiGrid({ count = 3, featured = false } = {}) {
  const gridClass = featured ? "app-usage-kpi-grid is-primary" : "app-usage-kpi-grid is-secondary";
  return `<div class="${gridClass}" aria-hidden="true">${times(count, () => skeletonKpi({ featured }))}</div>`;
}

export function skeletonChart({ height = 320 } = {}) {
  return `<div class="ui-skeleton ui-skeleton-chart" style="min-height:${Number(height) || 320}px" aria-hidden="true"></div>`;
}

export function skeletonTable({ rows = 5, columns = 4 } = {}) {
  return `<div class="ui-skeleton-table" aria-hidden="true">${times(rows, () =>
    `<div class="ui-skeleton-table-row">${times(columns, (index) =>
      `<span class="ui-skeleton ui-skeleton-line" style="width:${index === 0 ? "38%" : "22%"}"></span>`,
    )}</div>`,
  )}</div>`;
}

export function skeletonPage() {
  return `<div class="page-loading-shell" role="status" aria-live="polite" aria-label="Carregando indicadores">
    ${skeletonKpiGrid({ count: 3, featured: true })}
    ${skeletonChart({ height: 320 })}
    ${skeletonTable({ rows: 6, columns: 4 })}
  </div>`;
}

export function sectionLoading({ title, text } = {}) {
  return `<div class="usage-section-loading" role="status">
    ${title ? `<p>${escapeHtml(title)}</p>` : ""}
    ${text ? `<p class="note-muted">${escapeHtml(text)}</p>` : ""}
  </div>`;
}

export function sectionEmpty(text) {
  return `<p class="usage-quiet-empty" role="status">${escapeHtml(text)}</p>`;
}

export function sectionUnavailable(text = "Métrica não disponível nesta integração") {
  return `<p class="usage-quiet-empty" role="status">${escapeHtml(text)}</p>`;
}

export function sectionError({ title, text, retrySource } = {}) {
  return `<div class="usage-section-error" role="alert">
    <p>${escapeHtml(title || "Não foi possível carregar esta seção")}</p>
    ${text ? `<p class="note-muted">${escapeHtml(text)}</p>` : ""}
    ${retrySource ? `<button type="button" class="btn btn-secondary" data-retry-source="${escapeHtml(retrySource)}">Tentar novamente</button>` : ""}
  </div>`;
}
