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

export function tierBadge(tier, isDebts = null) {
  const label = tier || "Dados insuficientes";
  const cls =
    label === "Tier 1"
      ? "badge-tier-1"
      : label === "Tier 2"
        ? "badge-tier-2"
        : label === "Tier 3"
          ? "badge-tier-3"
          : label === "Tier 4"
            ? "badge-tier-4"
            : "badge-muted";
  const debts = isDebts ? `<span class="badge badge-debts">DEBTS</span>` : "";
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>${debts ? ` ${debts}` : ""}`;
}
