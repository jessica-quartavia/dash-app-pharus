import { skeletonPage } from "./skeleton.mjs";
import { escapeHtml } from "../utils/escape.mjs";

export function loadingState({
  title = "Carregando…",
  text = "Preparando os indicadores desta página.",
  variant = "page",
} = {}) {
  if (variant === "inline") {
    return `<div class="gd-status" role="status">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
    </div>`;
  }
  return skeletonPage();
}
