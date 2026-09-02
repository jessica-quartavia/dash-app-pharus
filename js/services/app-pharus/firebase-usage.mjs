import { authenticatedFetch } from "../../auth.mjs";
import { resolvePeriodRange } from "../../lib/filters/apply.mjs";

let cache = { at: 0, data: null, key: "" };
const TTL_MS = 120_000;

const FALLBACK = {
  available: false,
  userMessage: "Google Analytics temporariamente indisponível.",
  integration: { authenticated: false, propertyResolved: false },
  availability: { metrics: {}, dimensions: {} },
  kpis: [], usageSeries: [], platformSplit: [], versionRows: [], events: [],
  engagement: { sessionsPerUser: null, averageSessionDuration: null, userEngagementDuration: null, averageEngagementPerActiveUser: null },
  classification: { WEB: null, ANDROID: null, IOS: null, other: [], kind: "unknown" },
  retention: { available: false, message: "Não disponível pela integração atual" },
  userId: { available: false, supabaseMappingConfirmed: false },
};

export async function getFirebaseUsagePage(filters, { force = false } = {}) {
  const range = resolvePeriodRange(filters);
  const params = new URLSearchParams();
  if (range.startDate) params.set("startDate", range.startDate);
  if (range.endDate) params.set("endDate", range.endDate);
  const query = params.toString();
  const cacheKey = query || "default";
  if (!force && cache.data && cache.key === cacheKey && Date.now() - cache.at < TTL_MS) return cache.data;

  try {
    const response = await authenticatedFetch(`/api/firebase/usage${query ? `?${query}` : ""}`, { cache: "no-store" });
    if ((response.headers.get("content-type") || "").includes("application/json")) {
      const payload = await response.json().catch(() => null);
      if (payload && typeof payload === "object") {
        if (payload.available) cache = { at: Date.now(), data: payload, key: cacheKey };
        return payload;
      }
    }
  } catch {
    /* fallback independente abaixo */
  }
  return FALLBACK;
}
