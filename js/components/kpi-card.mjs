import { escapeHtml } from "../utils/escape.mjs";

export function kpiCard(label, value, note, options = {}) {
  const classes = ["kpi-card"];
  if (options.highlight) classes.push("kpi-card-highlight");
  if (options.compact) classes.push("kpi-card-compact");
  if (options.featured) classes.push("kpi-card-featured");
  if (options.primary) classes.push("kpi-card-primary");
  const title = options.tooltip ? ` title="${escapeHtml(options.tooltip)}"` : "";
  const tone = options.tone ? `<span class="kpi-tone-${escapeHtml(options.tone)}"> ${escapeHtml(note)}</span>` : "";
  const noteHtml = note
    ? `<div class="kpi-note">${options.tone ? tone : escapeHtml(note)}</div>`
    : "";
  return `<article class="${classes.join(" ")}"${title}>
    <div class="kpi-label">${escapeHtml(label)}</div>
    <div class="kpi-value">${value}</div>
    ${noteHtml}
  </article>`;
}

export function kpiRow(cards, variant = "") {
  const cls = ["kpi-row"];
  if (variant) cls.push(variant);
  return `<div class="${cls.join(" ")}">${cards.join("")}</div>`;
}
