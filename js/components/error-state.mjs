import { escapeHtml } from "../utils/escape.mjs";

export function errorState({
  title = "Não foi possível carregar esta página",
  text = "Tente novamente. Se o problema persistir, recarregue o portal.",
} = {}) {
  return `<div class="gd-status page-inline-error" role="alert">
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(text)}</span>
    <div><button type="button" class="btn btn-secondary" data-page-retry>Tentar novamente</button></div>
  </div>`;
}
