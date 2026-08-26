import { escapeHtml } from "../utils/escape.mjs";
import { formatCurrencyCompact, formatDate, formatDateTime, formatNumber, formatPercent } from "../utils/format.mjs";

export function formatKpiValue(kpi) {
  if (kpi.status === "pending" || kpi.status === "unavailable") {
    return escapeHtml(kpi.value || (kpi.status === "pending" ? "Regra pendente" : "Dados indisponíveis"));
  }
  if (kpi.kind === "currency") return escapeHtml(formatCurrencyCompact(kpi.value));
  if (kpi.kind === "percent") return escapeHtml(formatPercent(kpi.value, { digits: kpi.digits }));
  if (kpi.kind === "date") return escapeHtml(formatDate(kpi.value));
  if (kpi.kind === "datetime") return escapeHtml(formatDateTime(kpi.value));
  if (kpi.kind === "days") return kpi.value == null ? "—" : `${formatNumber(kpi.value)} dias`;
  if (kpi.kind === "text") return escapeHtml(kpi.value ?? "—");
  return escapeHtml(formatNumber(kpi.value));
}
