import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { todayIso } from "../../js/lib/filters/period.mjs";
import { resolveGa4Config, safeGa4Error, ga4EnvPresence } from "./config.mjs";

export const GA4_METRICS = [
  "activeUsers",
  "active1DayUsers",
  "active7DayUsers",
  "active28DayUsers",
  "newUsers",
  "sessions",
  "engagedSessions",
  "eventCount",
  "userEngagementDuration",
  "screenPageViews",
  "sessionsPerUser",
  "averageSessionDuration",
];

export const WEB_EVENT_NAMES = ["page_view", "scroll", "click", "form_start", "form_submit", "view_search_results"];
export const APP_EVENT_NAMES = ["screen_view", "app_open", "app_update", "app_remove", "first_open", "in_app_purchase", "notification_open", "user_engagement", "os_update"];

const SNAPSHOT_METRICS = new Set(["active1DayUsers", "active7DayUsers", "active28DayUsers"]);

const KPI_DEFINITIONS = [
  ["active1DayUsers", "Usuários ativos 1 dia", "number"],
  ["active7DayUsers", "Usuários ativos 7 dias", "number"],
  ["active28DayUsers", "Usuários ativos 28 dias", "number"],
  ["sessions", "Sessões", "number"],
  ["newUsers", "Novos usuários", "number"],
  ["sessionsPerUser", "Sessões por usuário", "decimal"],
];

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function logGa4(event, extra) {
  if (process.env.NODE_TEST_CONTEXT) return;
  if (extra === undefined) console.info("[ga4]", event);
  else console.info("[ga4]", event, extra);
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addDaysToIso(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function defaultRange(now = new Date()) {
  const endDate = todayIso(now);
  return { startDate: addDaysToIso(endDate, -29), endDate };
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

export function reportRows(response, dimensions, metric) {
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

export function formatGa4Date(value) {
  const text = String(value || "");
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  return text || null;
}

export function classifyPlatformRows(rows = []) {
  const counts = { WEB: null, ANDROID: null, IOS: null };
  const other = [];
  for (const row of rows) {
    const key = String(row.platform || "").trim().toUpperCase();
    const value = row.activeUsers == null ? null : row.activeUsers;
    if (key === "WEB") counts.WEB = value;
    else if (key === "ANDROID") counts.ANDROID = value;
    else if (key === "IOS") counts.IOS = value;
    else other.push({ platform: row.platform, activeUsers: value });
  }
  const hasWeb = (counts.WEB || 0) > 0;
  const hasMobile = (counts.ANDROID || 0) > 0 || (counts.IOS || 0) > 0;
  const kind = hasWeb && hasMobile ? "mixed" : hasMobile ? "mobile" : hasWeb ? "web" : "unknown";
  return { ...counts, other, kind };
}

export function summarizeDailySeries(rows = []) {
  const values = rows.map((row) => row.activeUsers).filter((value) => value != null);
  return {
    firstDate: formatGa4Date(rows[0]?.date),
    lastDate: formatGa4Date(rows.at(-1)?.date),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    lastValue: values.at(-1) ?? null,
    points: rows.length,
  };
}

export function classifyEventName(name) {
  if (WEB_EVENT_NAMES.includes(name)) return "web";
  if (APP_EVENT_NAMES.includes(name)) return "app";
  return "other";
}

function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function maskedIdentifier(value) {
  const text = String(value || "");
  if (text.length < 9) return "[masked]";
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

function metadataAvailability(metadata) {
  const metricNames = new Set((metadata?.metrics || []).map((item) => item.apiName));
  const dimensions = metadata?.dimensions || [];
  const dimensionNames = new Set(dimensions.map((item) => item.apiName));
  const userIdCandidates = dimensions.filter((item) => {
    const apiName = String(item.apiName || "");
    const text = `${apiName} ${item.uiName || ""} ${item.description || ""}`.toLowerCase();
    if (apiName === "signedInWithUserId") return false;
    if (apiName.startsWith("customUser:")) return true;
    return /userid|user_id|user id|id do usu[aá]rio/i.test(text);
  });
  return {
    metrics: Object.fromEntries(GA4_METRICS.map((name) => [name, metricNames.has(name)])),
    dimensions: {
      date: dimensionNames.has("date"),
      platform: dimensionNames.has("platform"),
      appVersion: dimensionNames.has("appVersion"),
      eventName: dimensionNames.has("eventName"),
      userId: dimensionNames.has("userId"),
      signedInWithUserId: dimensionNames.has("signedInWithUserId"),
    },
    userIdCandidates: userIdCandidates.map((item) => ({ apiName: item.apiName, uiName: item.uiName })),
    retentionMetrics: (metadata?.metrics || [])
      .filter((item) => /cohort|retention/i.test(`${item.apiName || ""} ${item.uiName || ""}`))
      .map((item) => item.apiName),
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

async function querySingleMetric(client, property, metric, range) {
  const dateRange = SNAPSHOT_METRICS.has(metric)
    ? { startDate: range.endDate, endDate: range.endDate }
    : range;
  const [response] = await client.runReport({
    property,
    dateRanges: [dateRange],
    metrics: [{ name: metric }],
  });
  return { supported: true, value: metricMap(response)[metric] ?? toNumber(response?.rows?.[0]?.metricValues?.[0]?.value) };
}

async function probeUserIdentification(client, property, range, availability) {
  const candidates = [];
  if (availability.dimensions.userId) candidates.push({ apiName: "userId", uiName: "User ID", origin: "GA4 userId dimension" });
  for (const item of availability.userIdCandidates || []) {
    if (!candidates.some((candidate) => candidate.apiName === item.apiName)) {
      candidates.push({ ...item, origin: "metadata candidate" });
    }
  }

  const attempts = [];
  for (const candidate of candidates.slice(0, 12)) {
    const result = await runSafe(async () => {
      const [response] = await client.runReport({
        property,
        dateRanges: [range],
        dimensions: [{ name: candidate.apiName }],
        metrics: [{ name: "activeUsers" }],
        limit: 50,
      });
      return response;
    });
    if (!result.ok) {
      attempts.push({ ...candidate, supported: false, error: result.error });
      continue;
    }
    const rows = reportRows(result.value, [candidate.apiName], "activeUsers")
      .map((row) => row[candidate.apiName])
      .filter((value) => value && value !== "(not set)");
    attempts.push({
      ...candidate,
      supported: true,
      distinctInSample: rows.length,
      rowCount: result.value?.rowCount ?? rows.length,
      uuidLikeCount: rows.filter(looksLikeUuid).length,
      maskedSamples: rows.slice(0, 3).map(maskedIdentifier),
    });
  }

  const usable = attempts.find((item) => item.supported && item.distinctInSample > 0);
  const uuidLike = Boolean(usable && usable.uuidLikeCount > 0);
  return {
    available: Boolean(usable),
    rawDimensionAvailable: availability.dimensions.userId,
    signedInIndicatorAvailable: availability.dimensions.signedInWithUserId,
    field: usable?.apiName || null,
    origin: usable?.origin || null,
    distinctInSample: usable?.distinctInSample || 0,
    uuidLike,
    supabaseMappingConfirmed: false,
    possibleSupabaseRelationship: uuidLike,
    maskedSamples: usable?.maskedSamples || [],
    candidates: attempts,
    note: usable
      ? "Identificador encontrado na Data API. Cruzamento com auth.users.id ainda não foi implementado nem confirmado."
      : "A Data API não confirmou uma dimensão raw compatível com auth.users.id. signedInWithUserId é apenas um indicador booleano.",
  };
}

function publicUserId(userId, includeSamples = false) {
  return {
    available: Boolean(userId?.available),
    field: userId?.field || null,
    origin: userId?.origin || null,
    distinctInSample: userId?.distinctInSample || 0,
    uuidLike: Boolean(userId?.uuidLike),
    rawDimensionAvailable: Boolean(userId?.rawDimensionAvailable),
    signedInIndicatorAvailable: Boolean(userId?.signedInIndicatorAvailable),
    supabaseMappingConfirmed: false,
    possibleSupabaseRelationship: Boolean(userId?.possibleSupabaseRelationship),
    note: userId?.note || "",
    ...(includeSamples ? { maskedSamples: userId?.maskedSamples || [], candidates: userId?.candidates || [] } : {}),
  };
}

function engagementFromSummary(summary) {
  const sessionsPerUser = summary.sessionsPerUser ?? null;
  const averageSessionDuration = summary.averageSessionDuration ?? null;
  const userEngagementDuration = summary.userEngagementDuration ?? null;
  const activeUsers = summary.activeUsers ?? summary.active28DayUsers ?? null;
  const canDeriveAverage = userEngagementDuration != null && activeUsers && activeUsers > 0;
  return {
    sessionsPerUser,
    averageSessionDuration,
    userEngagementDuration,
    averageEngagementPerActiveUser: canDeriveAverage ? userEngagementDuration / activeUsers : null,
    averageEngagementPerActiveUserSource: canDeriveAverage ? "userEngagementDuration / activeUsers" : null,
  };
}

export async function collectGa4Reports(client, property, range, availability) {
  const metricResults = {};
  for (const metric of GA4_METRICS) {
    if (!availability.metrics[metric]) {
      metricResults[metric] = { supported: false, value: null, error: "metric not in property metadata" };
      continue;
    }
    const result = await runSafe(() => querySingleMetric(client, property, metric, range));
    metricResults[metric] = result.ok
      ? result.value
      : { supported: false, value: null, error: result.error };
  }

  const tasks = {};
  if (availability.metrics.activeUsers && availability.dimensions.date) {
    tasks.daily = runSafe(async () => {
      const [response] = await client.runReport({
        property,
        dateRanges: [range],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      });
      return response;
    });
  }
  if (availability.metrics.activeUsers && availability.dimensions.platform) {
    tasks.platform = runSafe(async () => {
      const [response] = await client.runReport({
        property,
        dateRanges: [range],
        dimensions: [{ name: "platform" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      });
      return response;
    });
  }
  if (availability.metrics.activeUsers && availability.dimensions.appVersion) {
    tasks.versions = runSafe(async () => {
      const dimensions = [{ name: "appVersion" }];
      if (availability.dimensions.platform) dimensions.push({ name: "platform" });
      const [response] = await client.runReport({
        property,
        dateRanges: [range],
        dimensions,
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 100,
      });
      return response;
    });
  }
  if (availability.metrics.eventCount && availability.dimensions.eventName) {
    tasks.events = runSafe(async () => {
      const [response] = await client.runReport({
        property,
        dateRanges: [range],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: 30,
      });
      return response;
    });
  }

  const results = Object.fromEntries(await Promise.all(Object.entries(tasks).map(async ([key, promise]) => [key, await promise])));
  const daily = results.daily?.ok ? reportRows(results.daily.value, ["date"], "activeUsers").filter((row) => row.activeUsers != null) : [];
  const platform = results.platform?.ok ? percentageRows(reportRows(results.platform.value, ["platform"], "activeUsers"), "activeUsers") : [];
  const versionDimensions = availability.dimensions.platform ? ["appVersion", "platform"] : ["appVersion"];
  const versions = results.versions?.ok ? percentageRows(reportRows(results.versions.value, versionDimensions, "activeUsers"), "activeUsers") : [];
  const events = results.events?.ok
    ? percentageRows(reportRows(results.events.value, ["eventName"], "eventCount"), "eventCount")
      .map((row) => ({ ...row, class: classifyEventName(row.eventName) }))
    : [];
  const queryErrors = Object.fromEntries(Object.entries(results).filter(([, result]) => !result.ok).map(([key, result]) => [key, result.error]));
  const userId = await probeUserIdentification(client, property, range, availability);
  const classification = classifyPlatformRows(platform);
  const summary = Object.fromEntries(GA4_METRICS.map((name) => [name, metricResults[name]?.supported ? metricResults[name].value : null]));

  return {
    metricResults,
    summary,
    daily,
    dailySummary: summarizeDailySeries(daily),
    platform,
    classification,
    versions,
    events,
    userId,
    engagement: engagementFromSummary(summary),
    queryErrors,
  };
}

export async function queryGa4Usage(filters = {}, options = {}) {
  const env = options.env || process.env;
  const config = options.config || resolveGa4Config(env, options);
  const range = normalizeGa4Range(filters);
  const presence = ga4EnvPresence(env);
  logGa4("config loaded", {
    ok: config.ok,
    authMode: config.authMode,
    propertyOk: Boolean(config.propertyId),
    env: presence,
  });
  if (!config.ok) {
    logGa4("query error", { reason: config.errorCode || "config" });
    return unavailablePayload(config.errorCode === "GA4_PROPERTY_MISSING" ? "Propriedade GA4 não configurada." : "Credencial GA4 não configurada.", range);
  }

  const client = options.client || createGa4DataClient(config);
  const property = `properties/${config.propertyId}`;
  const metadataResult = await runSafe(async () => {
    const [response] = await client.getMetadata({ name: `${property}/metadata` });
    return response;
  });
  if (!metadataResult.ok) {
    logGa4("auth error", { ok: false });
    return unavailablePayload(metadataResult.error, range, { authenticated: false });
  }
  logGa4("auth ok");
  logGa4("property ok", { propertyOk: true });

  const availability = metadataAvailability(metadataResult.value);
  const collected = await collectGa4Reports(client, property, range, availability);
  const queryErrorCount = Object.keys(collected.queryErrors || {}).length;
  logGa4("query ok", { rows: collected.daily.length, errors: queryErrorCount });

  return {
    available: true,
    userMessage: null,
    integration: { authenticated: true, propertyResolved: true, propertyId: config.propertyId, authMode: config.authMode },
    diagnostics: { rowsReturned: collected.daily.length, errors: collected.queryErrors },
    availability: {
      metrics: availability.metrics,
      dimensions: availability.dimensions,
      userId: publicUserId(collected.userId),
    },
    kpis: KPI_DEFINITIONS.filter(([key]) => availability.metrics[key] && collected.summary[key] != null).map(([key, label, kind]) => ({
      key,
      label,
      kind,
      status: "ok",
      value: collected.summary[key],
      digits: kind === "decimal" ? 2 : undefined,
      note: "Google Analytics",
    })),
    summary: collected.summary,
    metricResults: collected.metricResults,
    usageSeries: collected.daily.map((row) => ({ date: formatGa4Date(row.date), count: row.activeUsers })),
    dailySummary: collected.dailySummary,
    platformSplit: collected.platform.map((row) => ({ label: row.platform, count: row.activeUsers, percent: row.percent })),
    classification: collected.classification,
    versionRows: collected.versions.map((row, index) => ({
      id: `ga4-version-${index}`,
      version: row.appVersion,
      platform: row.platform || null,
      activeUsers: row.activeUsers,
      percent: row.percent,
    })),
    events: collected.events.map((row, index) => ({
      id: `ga4-event-${index}`,
      name: row.eventName,
      count: row.eventCount,
      percent: row.percent,
      class: row.class,
    })),
    engagement: collected.engagement,
    retention: {
      available: false,
      message: "Não disponível pela integração atual",
      reason: "A Data API não oferece um equivalente simples e direto da retenção do painel Firebase.",
    },
    userId: publicUserId(collected.userId, options.includeSamples),
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
    kpis: [],
    usageSeries: [],
    platformSplit: [],
    versionRows: [],
    events: [],
    engagement: { sessionsPerUser: null, averageSessionDuration: null, userEngagementDuration: null, averageEngagementPerActiveUser: null },
    classification: { WEB: null, ANDROID: null, IOS: null, other: [], kind: "unknown" },
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
  if (!options.force && !options.client && cached && now - cached.at < CACHE_TTL_MS && cached.data?.available) return cached.data;
  const data = await queryGa4Usage(range, options);
  if (!options.client && data?.available) cache.set(key, { at: now, data });
  return data;
}

export function clearGa4Cache() {
  cache.clear();
}
