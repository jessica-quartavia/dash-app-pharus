import { escapeHtml } from "../utils/escape.mjs";
import { coverageLabel, formatNumber, formatPercent } from "../utils/format.mjs";
import { statusBadge } from "./status-badge.mjs";

export function coverageCard({ label, withData, withoutData, percent, tone }) {
  const status = coverageLabel(tone);
  return `<article class="coverage-card">
    <h3>${escapeHtml(label)}</h3>
    <div class="coverage-meta">
      <span>${formatNumber(withData)} com dado · ${formatNumber(withoutData)} sem dado</span>
      ${statusBadge(status)}
    </div>
    <div class="coverage-bar is-${escapeHtml(tone)}" title="${escapeHtml(label)}: ${formatPercent(percent)}">
      <span style="width:${Math.min(100, Math.max(0, percent))}%"></span>
    </div>
    <p class="kpi-note">${formatPercent(percent)} de cobertura</p>
  </article>`;
}
