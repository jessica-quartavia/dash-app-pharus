import { escapeHtml } from "../utils/escape.mjs";

const STATUS_CLASS = {
  Ativo: "badge-active",
  Inativo: "badge-cancelled",
  "Sem atividade recente": "badge-frozen",
  Saudável: "badge-success",
  Atenção: "badge-warning",
  Falha: "badge-danger",
  Boa: "badge-success",
  Crítica: "badge-danger",
  Sucesso: "badge-success",
  "Sucesso parcial": "badge-warning",
  Problema: "badge-danger",
  Realizada: "badge-active",
  Agendada: "badge-muted",
  "No-show": "badge-danger",
  Cancelada: "badge-cancelled",
  Concluído: "badge-active",
  Iniciado: "badge-warning",
  "Não iniciado": "badge-muted",
  "Dados indisponíveis": "badge-muted",
  Sim: "badge-active",
  Não: "badge-muted",
};

export function statusBadge(label) {
  const text = label == null || label === "" ? "Não informado" : String(label);
  const cls = STATUS_CLASS[text] || "badge-muted";
  return `<span class="badge ${cls}">${escapeHtml(text)}</span>`;
}

export function yesNoBadge(value) {
  if (value == null) return statusBadge("Dados indisponíveis");
  return statusBadge(value ? "Sim" : "Não");
}
