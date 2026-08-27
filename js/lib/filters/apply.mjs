/**
 * Filtros compartilhados — população oficial filtrada de forma consistente.
 */
import { resolveAppliedRange } from "./period.mjs";

export { DATE_RANGE_PRESETS as PERIOD_PRESETS } from "./period.mjs";

export function resolvePeriodRange(filters, today = new Date()) {
  const resolved = resolveAppliedRange(filters, today);
  return {
    from: resolved.startDate,
    to: resolved.endDate,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    invalid: resolved.invalid,
    period: resolved.period,
  };
}

export function inPeriod(dateValue, range) {
  if (!range?.from && !range?.to && !range?.startDate && !range?.endDate) return true;
  if (!dateValue) return false;
  const day = String(dateValue).slice(0, 10);
  const from = range.from || range.startDate;
  const to = range.to || range.endDate;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function matchesSearch(client, search) {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [client.id, client.name, client.email, client.advisor]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function matchesSelect(actual, expected) {
  if (!expected || expected === "all") return true;
  if (expected === "yes") return Boolean(actual);
  if (expected === "no") return !actual;
  return String(actual) === String(expected);
}

export function filterClients(clients, filters, { dateField = "registeredAt" } = {}) {
  const range = resolvePeriodRange(filters);
  return (clients || []).filter((client) => {
    if (!matchesSearch(client, filters.search)) return false;
    if (!inPeriod(client[dateField] || client.registeredAt, range)) return false;
    if (!matchesSelect(client.status, filters.status)) return false;
    if (!matchesSelect(client.hasOpenFinance, filters.openFinance)) return false;
    if (!matchesSelect(client.hasMechanisms, filters.hasMechanisms)) return false;
    if (!matchesSelect(client.hasWealth, filters.hasWealth)) return false;
    if (!matchesSelect(client.journeyStage, filters.journeyStage)) return false;
    if (filters.advisor && filters.advisor !== "all") {
      if (String(client.advisorId || "") !== String(filters.advisor)) return false;
    }
    if (filters.segment && filters.segment !== "all") {
      if (String(client.tier || "") !== String(filters.segment)) return false;
    }
    if (filters.debts && filters.debts !== "all") {
      if (filters.debts === "yes" && !client.isDebts) return false;
      if (filters.debts === "no" && client.isDebts) return false;
    }
    if (filters.client && filters.client !== "all" && client.id !== filters.client) return false;
    return true;
  });
}

export function defaultFilters(overrides = {}) {
  return {
    search: "",
    period: "all",
    startDate: null,
    endDate: null,
    dateFrom: "",
    dateTo: "",
    status: "all",
    openFinance: "all",
    hasMechanisms: "all",
    hasWealth: "all",
    journeyStage: "all",
    segment: "all",
    debts: "all",
    advisor: "all",
    client: "all",
    ...overrides,
  };
}
