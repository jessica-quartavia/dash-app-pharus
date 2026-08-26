import { escapeHtml } from "../utils/escape.mjs";

/**
 * Insight preparado para receber conteúdo gerado por IA no futuro.
 * source: "mock" | "ai"
 */
export function insightCard({
  kind = "Observação",
  title,
  body,
  source = "mock",
} = {}) {
  const sourceLabel = source === "ai" ? "Gerado por IA" : "Insight de demonstração";
  return `<article class="sc-insight" data-insight-source="${escapeHtml(source)}">
    <p class="sc-insight-label">${escapeHtml(kind)}</p>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(body)}</p>
    <p class="sc-insight-source">${escapeHtml(sourceLabel)}</p>
  </article>`;
}

export function insightGrid(insights) {
  if (!insights?.length) {
    return `<p class="placeholder-note">Nenhum insight disponível neste recorte.</p>`;
  }
  return `<div class="insight-grid">${insights.map((item) => insightCard(item)).join("")}</div>`;
}
