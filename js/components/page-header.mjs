import { escapeHtml } from "../utils/escape.mjs";

export function pageHeader({ eyebrow, title, description, actions = "" }) {
  return `<header class="page-header">
    <p class="eyebrow">${escapeHtml(eyebrow)}</p>
    <div class="page-header-row">
      <h1>${escapeHtml(title)}</h1>
      <div class="page-actions">${actions}</div>
    </div>
    ${description ? `<p class="page-description text-muted">${escapeHtml(description)}</p>` : ""}
  </header>`;
}
