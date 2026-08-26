/**
 * Período global do Dash App Pharus.
 * O componente devolve startDate/endDate. Cada página aplica na coluna certa.
 */
export const PORTAL_TIMEZONE = "America/Sao_Paulo";

export const DATE_RANGE_PRESETS = [
  { value: "all", label: "Todo o período" },
  { value: "today", label: "Hoje" },
  { value: "last_30", label: "Últimos 30 dias" },
  { value: "last_90", label: "Últimos 90 dias" },
  { value: "last_6m", label: "Últimos 6 meses" },
  { value: "last_12m", label: "Últimos 12 meses" },
  { value: "this_year", label: "Este ano" },
];

const ALIASES = {
  "30d": "last_30",
  "90d": "last_90",
  "12m": "last_12m",
  custom: "custom",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: PORTAL_TIMEZONE,
  month: "long",
  year: "numeric",
});

const brDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: PORTAL_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function partsInTimezone(date, timeZone = PORTAL_TIMEZONE) {
  const map = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return map;
}

export function todayIso(now = new Date()) {
  const parts = partsInTimezone(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Converte timestamptz para YYYY-MM-DD em America/Sao_Paulo. Datas já ISO (10 chars) passam direto. */
export function timestampToIsoDate(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (ISO_DATE.test(raw) && raw.length === 10) return raw;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return toIsoOrNull(raw);
  return todayIso(date);
}

export function isIsoDateString(value) {
  return ISO_DATE.test(String(value || "").slice(0, 10));
}

export function toIsoOrNull(value) {
  const iso = String(value || "").slice(0, 10);
  return isIsoDateString(iso) ? iso : null;
}

export function compareIsoDates(a, b) {
  const left = String(a || "").slice(0, 10);
  const right = String(b || "").slice(0, 10);
  if (!ISO_DATE.test(left) || !ISO_DATE.test(right)) return 0;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function isFutureIso(iso, now = new Date()) {
  if (!isIsoDateString(iso)) return false;
  return compareIsoDates(iso, todayIso(now)) > 0;
}

export function formatIsoDateBr(iso) {
  if (!isIsoDateString(iso)) return "";
  return brDateFormatter.format(new Date(`${iso}T12:00:00.000Z`));
}

export function normalizePeriodMode(value) {
  const raw = String(value || "all").trim();
  if (ALIASES[raw]) return ALIASES[raw];
  if (raw === "all" || raw === "today" || raw === "custom") return raw;
  if (DATE_RANGE_PRESETS.some((item) => item.value === raw)) return raw;
  return "all";
}

export function periodPresetLabel(mode) {
  const key = normalizePeriodMode(mode);
  return DATE_RANGE_PRESETS.find((item) => item.value === key)?.label || "Todo o período";
}

function isoFromUtcDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function utcFromIso(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysIso(iso, days) {
  const date = utcFromIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoFromUtcDate(date);
}

function addMonthsIso(iso, months) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return isoFromUtcDate(date);
}

export function normalizeCustomRange(startRaw, endRaw, now = new Date()) {
  let startDate = toIsoOrNull(startRaw);
  let endDate = toIsoOrNull(endRaw);
  if (!startDate && !endDate) return { ok: true, startDate: null, endDate: null, error: null };
  if ((startRaw && !startDate) || (endRaw && !endDate && String(endRaw).trim())) {
    return { ok: false, startDate: null, endDate: null, error: "invalid_date" };
  }
  if (startDate && isFutureIso(startDate, now)) return { ok: false, startDate: null, endDate: null, error: "future_date" };
  if (endDate && isFutureIso(endDate, now)) return { ok: false, startDate: null, endDate: null, error: "future_date" };
  if (startDate && endDate && compareIsoDates(startDate, endDate) > 0) {
    const swap = startDate;
    startDate = endDate;
    endDate = swap;
  }
  return { ok: true, startDate, endDate, error: null };
}

export function applyPeriodPreset(preset, now = new Date()) {
  const mode = normalizePeriodMode(preset);
  const today = todayIso(now);
  if (mode === "all") return { period: "all", startDate: null, endDate: null };
  if (mode === "today") return { period: "today", startDate: today, endDate: today };
  if (mode === "last_30") return { period: "last_30", startDate: addDaysIso(today, -30), endDate: today };
  if (mode === "last_90") return { period: "last_90", startDate: addDaysIso(today, -90), endDate: today };
  if (mode === "last_6m") return { period: "last_6m", startDate: addMonthsIso(today, -6), endDate: today };
  if (mode === "last_12m") return { period: "last_12m", startDate: addMonthsIso(today, -12), endDate: today };
  if (mode === "this_year") return { period: "this_year", startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
  return { period: "custom", startDate: null, endDate: null };
}

export function emptyPeriodRange() {
  return { period: "all", startDate: null, endDate: null };
}

export function readRangeFromFilters(filters = {}) {
  const startDate = toIsoOrNull(filters.startDate ?? filters.dateFrom ?? filters.from);
  const endDate = toIsoOrNull(filters.endDate ?? filters.dateTo ?? filters.to);
  const period = normalizePeriodMode(filters.period);
  return { period, startDate, endDate };
}

export function sanitizePeriodFilters(filters = {}, now = new Date()) {
  const current = readRangeFromFilters(filters);
  if (current.period === "all" && !current.startDate && !current.endDate) {
    return emptyPeriodRange();
  }
  if (current.period !== "custom" && current.period !== "all") {
    return applyPeriodPreset(current.period, now);
  }
  const normalized = normalizeCustomRange(current.startDate, current.endDate, now);
  if (!normalized.ok || (!normalized.startDate && !normalized.endDate)) {
    return emptyPeriodRange();
  }
  return { period: "custom", startDate: normalized.startDate, endDate: normalized.endDate };
}

export function formatPeriodFieldLabel(filters = {}, now = new Date()) {
  const sanitized = sanitizePeriodFilters(filters, now);
  if (sanitized.period === "all" || (!sanitized.startDate && !sanitized.endDate)) return "Todo o período";
  if (sanitized.period !== "custom") return periodPresetLabel(sanitized.period);
  const start = formatIsoDateBr(sanitized.startDate);
  const end = formatIsoDateBr(sanitized.endDate);
  if (start && end) return `${start} – ${end}`;
  return start || end || "Personalizado";
}

export function normalizeRangeSelection(startIso, endIso, now = new Date()) {
  const normalized = normalizeCustomRange(startIso, endIso, now);
  if (!normalized.ok) return { startDate: null, endDate: null, error: normalized.error };
  return { startDate: normalized.startDate, endDate: normalized.endDate, error: null };
}

export function nextDraftAfterDayClick(draft, iso, now = new Date()) {
  if (!iso || isFutureIso(iso, now)) return { draft, changed: false };
  const next = {
    period: "custom",
    startDate: draft.startDate || null,
    endDate: draft.endDate || null,
    hover: "",
  };
  const pickingEnd = Boolean(next.startDate && !next.endDate);
  if (!pickingEnd) {
    next.startDate = iso;
    next.endDate = null;
    return { draft: next, changed: true };
  }
  if (next.startDate === iso) {
    next.endDate = iso;
    return { draft: next, changed: true };
  }
  const normalized = normalizeRangeSelection(next.startDate, iso, now);
  if (normalized.error) return { draft, changed: false };
  next.startDate = normalized.startDate;
  next.endDate = normalized.endDate;
  return { draft: next, changed: true };
}

export function resolveAppliedRange(filters = {}, now = new Date()) {
  const sanitized = sanitizePeriodFilters(filters, now);
  if (!sanitized.startDate && !sanitized.endDate) {
    return { startDate: null, endDate: null, period: "all", invalid: false };
  }
  if (sanitized.startDate && sanitized.endDate && sanitized.startDate > sanitized.endDate) {
    return { startDate: null, endDate: null, period: "all", invalid: true };
  }
  return { ...sanitized, invalid: false };
}

export function monthMatrix(year, month, now = new Date()) {
  const today = todayIso(now);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ iso: "", day: "", inMonth: false, isToday: false, disabled: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      iso,
      day,
      inMonth: true,
      isToday: iso === today,
      disabled: isFutureIso(iso, now),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ iso: "", day: "", inMonth: false, isToday: false, disabled: true });
  }
  return cells;
}

export function monthTitle(year, month) {
  const label = monthFormatter.format(new Date(Date.UTC(year, month - 1, 1, 12)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonth(year, month, delta) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function canNavigateToMonth(year, month, now = new Date()) {
  const today = todayIso(now);
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  if (year < currentYear - 20) return false;
  if (year > currentYear) return false;
  if (year === currentYear && month > currentMonth) return false;
  return true;
}

export function isRangeComplete(startDate, endDate) {
  return Boolean(startDate && endDate);
}

export function rangeIncludes(iso, startDate, endDate) {
  if (!iso || !startDate || !endDate) return false;
  return compareIsoDates(iso, startDate) >= 0 && compareIsoDates(iso, endDate) <= 0;
}

export function isRangeEdge(iso, startDate, endDate) {
  return Boolean(iso && (iso === startDate || iso === endDate));
}

export function draftHighlight(iso, draft) {
  const startDate = draft.startDate;
  const endDate = draft.endDate;
  const hoverIso = draft.hover;
  const pendingEnd = Boolean(startDate && !endDate);
  const edge = isRangeEdge(iso, startDate, endDate) || (pendingEnd && iso === startDate);
  const selected =
    edge
    || (pendingEnd && hoverIso && rangeIncludes(iso, startDate, hoverIso))
    || (startDate && endDate && rangeIncludes(iso, startDate, endDate));
  return { selected, edge, hoverEnd: Boolean(pendingEnd && hoverIso && iso === hoverIso) };
}
