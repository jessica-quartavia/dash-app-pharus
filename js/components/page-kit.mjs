import { escapeHtml } from "../utils/escape.mjs";

export function methodologyBanner(text, details = "") {
  const extra = details
    ? `<details class="sc-methodology-details"><summary>Ver nota metodológica</summary><p>${escapeHtml(details)}</p></details>`
    : "";
  return `<aside class="sc-methodology-banner"><p class="sc-methodology-note">${escapeHtml(text)}</p>${extra}</aside>`;
}

export function sectionBlock({ id, title, lead, body }) {
  return `<section class="section-block" id="${escapeHtml(id)}">
    <h2>${escapeHtml(title)}</h2>
    ${lead ? `<p class="note-muted">${escapeHtml(lead)}</p>` : ""}
    ${body}
  </section>`;
}
