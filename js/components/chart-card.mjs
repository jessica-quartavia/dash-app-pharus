import { escapeHtml } from "../utils/escape.mjs";

export function chartCard({ title, subtitle = "", body, featured = false, quiet = false }) {
  const classes = ["chart-card"];
  if (featured) classes.push("chart-card-featured");
  if (quiet) classes.push("chart-card-quiet");
  return `<article class="${classes.join(" ")}">
    <h3>${escapeHtml(title)}</h3>
    ${subtitle ? `<p class="chart-card-subtitle">${escapeHtml(subtitle)}</p>` : ""}
    <div class="chart-card-body">${body}</div>
  </article>`;
}

export function chartGrid(cards, columns = 2) {
  const cls = columns === 3 ? "chart-grid chart-grid-three" : "chart-grid";
  return `<div class="${cls}">${cards.join("")}</div>`;
}
