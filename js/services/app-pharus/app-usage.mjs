import { getExpoUsagePage } from "./expo-usage.mjs";
import { getFirebaseUsagePage } from "./firebase-usage.mjs";
import { authenticatedFetch } from "../../auth.mjs";
import { readApiJson } from "../../lib/api-json.mjs";
import { PHARUS_FALLBACK, loadUsageSources } from "./usage-sources.mjs";

export {
  ANALYTICS_FALLBACK,
  EXPO_FALLBACK,
  PHARUS_FALLBACK,
  loadUsageSources,
  mergeUsageSources,
  withTimeout,
} from "./usage-sources.mjs";

let contextCache = { at: 0, data: null };

async function getUsageContext({ force = false } = {}) {
  if (!force && contextCache.data && Date.now() - contextCache.at < 60_000) return contextCache.data;
  try {
    const response = await authenticatedFetch("/api/dashboard?domain=usage-context", { cache: "no-store" });
    const data = await readApiJson(response, "Não foi possível carregar o contexto do App Pharus.");
    contextCache = { at: Date.now(), data };
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
    quickWaitMs: options.quickWaitMs,
    expoTimeoutMs: options.expoTimeoutMs,
    pharusTimeoutMs: options.pharusTimeoutMs,
  });
}
