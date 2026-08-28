import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { resolveGa4Config, safeGa4Error } from "./config.mjs";

export const GA4_METRICS = [
  "activeUsers",
  "active1DayUsers",
  "active7DayUsers",
  "active28DayUsers",
  "sessions",
  "eventCount",
  "newUsers",
  "engagedSessions",
  "engagementRate",
  "userEngagementDuration",
  "screenPageViews",
];

const KPI_DEFINITIONS = [
  ["active1DayUsers", "Usuários ativos hoje / 1 dia", "number"],
  ["active7DayUsers", "Usuários ativos 7 dias", "number"],
  ["active28DayUsers", "Usuários ativos 28 dias", "number"],
  ["sessions", "Sessões", "number"],
  ["newUsers", "Novos usuários", "number"],
  ["eventCount", "Eventos", "number"],
];

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function toNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

export function normalizeGa4Range(filters = {}) {
  const fallback = defaultRange();
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(filters.startDate || "") ? filters.startDate : fallback.startDate;
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(filters.endDate || "") ? filters.endDate : fallback.endDate;
  if (startDate > endDate) throw new Error("Período inválido para o Google Analytics.");
  return { startDate, endDate };
}

function metricMap(response) {
  const headers = response?.metricHeaders || [];
  const values = response?.rows?.[0]?.metricValues || [];
  return Object.fromEntries(headers.map((header, index) => [header.name, toNumber(values[index]?.value)]));
}

function reportRows(response, dimensions, metric) {
  return (response?.rows || []).map((row, index) => {
    const item = { id: `${index}` };
    dimensions.forEach((name, dimensionIndex) => {
      item[name] = row.dimensionValues?.[dimensionIndex]?.value || "(not set)";
    });
    item[metric] = toNumber(row.metricValues?.[0]?.value);
    return item;
  });
}

function percentageRows(rows, valueKey) {
  const total = rows.reduce((sum, row) => sum + (row[valueKey] || 0), 0);
  return rows.map((row) => ({ ...row, percent: total ? (row[valueKey] / total) * 100 : 0 }));
}

function metadataAvailability(metadata) {
  const metricNames = new Set((metadata?.metrics || []).map((item) => item.apiName));
  const dimensions = metadata?.dimensions || [];
  const dimensionNames = new Set(dimensions.map((item) => item.apiName));
  const userIdCandidates = dimensions.filter((item) => {
    const text = `${item.apiName || ""} ${item.uiName || ""} ${item.description || ""}`.toLowerCase();
    return /(^|[^a-z])(user[ _-]?id|id[ _-]?do[ _-]?usu[aá]rio)([^a-z]|$)/i.test(text);
  });
  return {
    metrics: Object.fromEntries(GA4_METRICS.map((name) => [name, metricNames.has(name)])),
    dimensions: {
      date: dimensionNames.has("date"),
      platform: dimensionNames.has("platform"),
      appVersion: dimensionNames.has("appVersion"),
      eventName: dimensionNames.has("eventName"),
      signedInWithUserId: dimensionNames.has("signedInWithUserId"),
    },
    userId: {
      available: false,
      rawDimensionAvailable: dimensionNames.has("userId"),
      signedInIndicatorAvailable: dimensionNames.has("signedInWithUserId"),
      candidates: userIdCandidates.map((item) => ({ apiName: item.apiName, uiName: item.uiName })),
      supabaseMappingConfirmed: false,
      note: "A Data API não confirmou uma dimensão raw compatível com auth.users.id.",
    },
  };
}

async function runSafe(task) {
  try {
    return { ok: true, value: await task() };
  } catch (error) {
    return { ok: false, error: safeGa4Error(error) };
  }
}

export function createGa4DataClient(config) {
  return new BetaAnalyticsDataClient(config.clientOptions);
}

export async function queryGa4Usage(filters = {}, options = {}) {
  const config = options.config || resolveGa4Config(options.env || process.env, options);
  const range = normalizeGa4Range(filters);
  if (!config.ok) {
    return unavailablePayload(config.errorCode === "GA4_PROPERTY_MISSING" ? "Propriedade GA4 não configurada." : "Credencial GA4 não configurada.", range);
  }

  const client = options.client || createGa4DataClient(config);
  const property = `properties/${config.propertyId}`;
  const metadataResult = await runSafe(async () => {
    const [response] = await client.getMetadata({ name: `${property}/metadata` });
    return response;
  });
  if (!metadataResult.ok) return unavailablePayload(metadataResult.error, range, { authenticated: false });

  const availability = metadataAvailability(metadataResult.value);
  const confirmedMetrics = GA4_METRICS.filter((name) => availability.metrics[name]);
  const tasks = {};

  if (confirmedMetrics.length) {
    tasks.summary = runSafe(async () => {
      const [response] = await client.runReport({ property, dateRanges: [range], metrics: confirmedMetrics.map((name) => ({ name })) });
      return response;
    });
  }
  if (availability.metrics.activeUsers && availability.dimensions.date) {
    tasks.daily = runSafe(async () => {
      const [response] = await client.runReport({ property, dateRanges: [range], dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }], orderBys: [{ dimension: { dimensionName: "date" } }] });
      return response;
    });
  }
  if (availability.metrics.activeUsers && availability.dimensions.platform) {
    tasks.platform = runSafe(async () => {
      const [response] = await client.runReport({ property, dateRanges: [range], dimensions: [{ name: "platform" }], metrics: [{ name: "activeUsers" }], orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }] });
      return response;
    });
  }
  if (availability.metrics.activeUsers && availability.dimensions.appVersion) {
    tasks.versions = runSafe(async () => {
      const dimensions = [{ name: "appVersion" }];
      if (availability.dimensions.platform) dimensions.push({ name: "platform" });
      const [response] = await client.runReport({ property, dateRanges: [range], dimensions, metrics: [{ name: "activeUsers" }], orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: 100 });
      return response;
    });
  }
  if (availability.metrics.eventCount && availability.dimensions.eventName) {
    tasks.events = runSafe(async () => {
      const [response] = await client.runReport({ property, dateRanges: [range], dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }], orderBys: [{ metric: { metricName: "eventCount" }, desc: true }], limit: 100 });
      return response;
    });
  }

  const results = Object.fromEntries(await Promise.all(Object.entries(tasks).map(async ([key, promise]) => [key, await promise])));
  const summary = results.summary?.ok ? metricMap(results.summary.value) : {};
  const daily = results.daily?.ok ? reportRows(results.daily.value, ["date"], "activeUsers").filter((row) => row.activeUsers != null) : [];
  const platform = results.platform?.ok ? percentageRows(reportRows(results.platform.value, ["platform"], "activeUsers"), "activeUsers") : [];
  const versionDimensions = availability.dimensions.platform ? ["appVersion", "platform"] : ["appVersion"];
  const versions = results.versions?.ok ? percentageRows(reportRows(results.versions.value, versionDimensions, "activeUsers"), "activeUsers") : [];
  const events = results.events?.ok ? percentageRows(reportRows(results.events.value, ["eventName"], "eventCount"), "eventCount") : [];
  const queryErrors = Object.fromEntries(Object.entries(results).filter(([, result]) => !result.ok).map(([key, result]) => [key, result.error]));

  return {
    available: true,
    userMessage: null,
    integration: { authenticated: true, propertyResolved: true, propertyId: config.propertyId, authMode: config.authMode },
    diagnostics: { rowsReturned: daily.length, errors: queryErrors },
    availability,
    kpis: KPI_DEFINITIONS.filter(([key]) => availability.metrics[key] && summary[key] != null).map(([key, label, kind]) => ({ key, label, kind, status: "ok", value: summary[key], note: "Firebase Analytics / GA4" })),
    summary,
    usageSeries: daily.map((row) => ({ date: `${row.date.slice(0, 4)}-${row.date.slice(4, 6)}-${row.date.slice(6, 8)}`, count: row.activeUsers })),
    platformSplit: platform.map((row) => ({ label: row.platform, count: row.activeUsers, percent: row.percent })),
    versionRows: versions.map((row, index) => ({ id: `ga4-version-${index}`, version: row.appVersion, platform: row.platform || null, activeUsers: row.activeUsers, percent: row.percent })),
    events: events.map((row, index) => ({ id: `ga4-event-${index}`, name: row.eventName, count: row.eventCount, percent: row.percent })),
    retention: { available: false, message: "Não disponível pela integração atual", reason: "Equivalência com a retenção do Firebase ainda não comprovada." },
    userId: availability.userId,
    period: range,
  };
}

export function unavailablePayload(message, period, integration = {}) {
  return {
    available: false,
    userMessage: message,
    integration: { authenticated: false, propertyResolved: false, ...integration },
    diagnostics: { rowsReturned: 0, errors: {} },
    availability: { metrics: {}, dimensions: {}, userId: { available: false, supabaseMappingConfirmed: false } },
    kpis: [], usageSeries: [], platformSplit: [], versionRows: [], events: [],
    retention: { available: false, message: "Não disponível pela integração atual" },
    userId: { available: false, supabaseMappingConfirmed: false },
    period,
  };
}

export async function buildGa4UsageDataset(filters = {}, options = {}) {
  const range = normalizeGa4Range(filters);
  const key = `${range.startDate}:${range.endDate}`;
  const now = options.now?.() || Date.now();
  const cached = cache.get(key);
  if (!options.force && !options.client && cached && now - cached.at < CACHE_TTL_MS) return cached.data;
  const data = await queryGa4Usage(range, options);
  if (!options.client) cache.set(key, { at: now, data });
  return data;
}

export function clearGa4Cache() {
  cache.clear();
}
