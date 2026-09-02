import { getExpoUsagePage } from "./expo-usage.mjs";
import { getFirebaseUsagePage } from "./firebase-usage.mjs";
import { authenticatedFetch } from "../../auth.mjs";
import { readApiJson } from "../../lib/api-json.mjs";
import { PHARUS_FALLBACK, loadUsageSources, retryUsageSource } from "./usage-sources.mjs";

export {
  ANALYTICS_FALLBACK,
  ANALYTICS_LOADING,
  EXPO_FALLBACK,
  EXPO_LOADING,
  PHARUS_FALLBACK,
  PHARUS_LOADING,
  loadUsageSources,
  mergeUsageSources,
  retryUsageSource,
  withTimeout,
} from "./usage-sources.mjs";

let contextCache = { at: 0, data: null };

async function getUsageContext({ force = false } = {}) {
  if (!force && contextCache.data && Date.now() - contextCache.at < 60_000) return contextCache.data;
  try {
    const response = await authenticatedFetch("/api/dashboard?domain=usage-context", { cache: "no-store" });
    const data = await readApiJson(response, "Não foi possível carregar o contexto do App Pharus.");
    if (data?.available) contextCache = { at: Date.now(), data };
    return data;
  } catch {
    return PHARUS_FALLBACK;
  }
}

export async function getAppUsagePage(filters, options = {}) {
  return loadUsageSources({
    analyticsTask: () => getFirebaseUsagePage(filters, options),
    expoTask: () => getExpoUsagePage(filters, options),
    pharusTask: () => getUsageContext(options),
    onPartial: options.onPartial,
    previous: options.previous,
    keepPharusOnReload: options.keepPharusOnReload,
    quickWaitMs: options.quickWaitMs,
    expoTimeoutMs: options.expoTimeoutMs,
    pharusTimeoutMs: options.pharusTimeoutMs,
  });
}

export async function retryAppUsageSource(source, filters, current, options = {}) {
  return retryUsageSource(source, {
    current,
    analyticsTask: () => getFirebaseUsagePage(filters, { ...options, force: true }),
    expoTask: () => getExpoUsagePage(filters, { ...options, force: true }),
    pharusTask: () => getUsageContext({ ...options, force: true }),
  });
}
