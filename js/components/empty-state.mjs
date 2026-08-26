import { escapeHtml } from "../utils/escape.mjs";

export function emptyState({
  title = "Nenhum dado neste recorte",
  text = "Ajuste os filtros para ver outro conjunto de clientes.",
} = {}) {
  return `<div class="gd-status" role="status">
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(text)}</span>
  </div>`;
}
