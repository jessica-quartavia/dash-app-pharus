const numberFmt = new Intl.NumberFormat("pt-BR");
const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const currencyExactFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return numberFmt.format(Number(value));
}

export function formatDecimal(value, { digits = 1 } = {}) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDurationSeconds(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const total = Math.max(0, Math.round(Number(value)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return minutes ? `${hours}h ${minutes} min` : `${hours}h`;
  if (minutes && seconds) return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
  if (minutes) return `${minutes} min`;
  return `${seconds} s`;
}

export function formatPercent(value, { digits } = {}) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const resolved = digits != null ? digits : Math.abs(n - Math.round(n)) < 0.05 ? 0 : 1;
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: resolved,
    maximumFractionDigits: resolved,
  })}%`;
}

export function formatCurrency(value, { compact = false, exact = false } = {}) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  if (compact) return formatCurrencyCompact(value);
  if (exact) return formatCurrencyExact(value);
  return currencyFmt.format(Number(value));
}

export function formatCurrencyExact(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return currencyExactFmt.format(Number(value));
}

function formatCompactAmount(n, maxDigits) {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  });
}

/** Rótulos de gráfico/KPI: R$ 850 · R$ 12,5 mil · R$ 2,15 mi · R$ 1,2 bi */
export function formatCurrencyCompact(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1000) return `${sign}R$ ${formatCompactAmount(abs, 0)}`;
  if (abs < 1_000_000) return `${sign}R$ ${formatCompactAmount(abs / 1000, 1)} mil`;
  if (abs < 1_000_000_000) return `${sign}R$ ${formatCompactAmount(abs / 1_000_000, 2)} mi`;
  return `${sign}R$ ${formatCompactAmount(abs / 1_000_000_000, 1)} bi`;
}

export function formatDate(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function toIsoDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function median(values) {
  const list = (values || []).filter((n) => Number.isFinite(Number(n))).map(Number).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

export function percentOf(part, total) {
  if (!total) return 0;
  return (Number(part) / Number(total)) * 100;
}

export function coverageTone(percent) {
  if (percent >= 70) return "good";
  if (percent >= 40) return "warn";
  return "critical";
}

export function coverageLabel(tone) {
  if (tone === "good") return "Boa";
  if (tone === "warn") return "Atenção";
  return "Crítica";
}

export function daysBetween(a, b) {
  const start = new Date(a);
  const end = new Date(b);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}
