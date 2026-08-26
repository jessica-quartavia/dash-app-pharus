export function loadingState({
  title = "Carregando…",
  text = "Preparando os indicadores desta página.",
} = {}) {
  return `<div class="gd-status" role="status">
    <strong>${title}</strong>
    <span>${text}</span>
  </div>`;
}
