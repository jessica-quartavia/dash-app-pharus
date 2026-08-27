import { authenticatedFetch } from "../../auth.mjs";
import { resolvePeriodRange } from "../../lib/filters/apply.mjs";

let cache = { at: 0, data: null, key: "" };
const TTL_MS = 120_000;

const FALLBACK = {
  available: false,
  userMessage: "Integração com Expo em configuração",
  integration: { authenticated: false, projectResolved: false },
  kpis: [
    {
      key: "integration",
      label: "Utilização do App",
      status: "unavailable",
      kind: "text",
      value: "Dados de utilização ainda não disponíveis",
      note: "Telemetria Expo/EAS separada da base de clientes Supabase.",
    },
  ],
  usageSeries: [],
  platformSplit: [],
  versionRows: [],
  updates: [],
  builds: [],
  channels: [],
  methodology:
    "Telemetria agregada do aplicativo via Expo/EAS. Separada da base oficial de clientes no Supabase.",
};

export async function getExpoUsagePage(filters, { force = false } = {}) {
  const range = resolvePeriodRange(filters);
  const params = new URLSearchParams();
  if (range.startDate) params.set("startDate", range.startDate);
  if (range.endDate) params.set("endDate", range.endDate);
  const query = params.toString();
  const cacheKey = query || "all";

  if (!force && cache.data && cache.key === cacheKey && Date.now() - cache.at < TTL_MS) {
    return cache.data;
  }

  try {
    const response = await authenticatedFetch(`/api/expo/usage${query ? `?${query}` : ""}`, {
      cache: "no-store",
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null);
      if (payload && typeof payload === "object") {
        cache = { at: Date.now(), data: payload, key: cacheKey };
        return payload;
      }
    }
  } catch {
    /* resposta controlada abaixo */
  }

  cache = { at: Date.now(), data: FALLBACK, key: cacheKey };
  return FALLBACK;
}
