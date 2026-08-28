import { getExpoUsagePage } from "./expo-usage.mjs";
import { authenticatedFetch } from "../../auth.mjs";
import { readApiJson } from "../../lib/api-json.mjs";

let contextCache = { at: 0, data: null };

async function getUsageContext({ force = false } = {}) {
  if (!force && contextCache.data && Date.now() - contextCache.at < 60_000) return contextCache.data;
  const response = await authenticatedFetch("/api/dashboard?domain=usage-context", { cache: "no-store" });
  const data = await readApiJson(response, "Não foi possível carregar o contexto do App Pharus.");
  contextCache = { at: Date.now(), data };
  return data;
}

export async function getAppUsagePage(filters, options = {}) {
  const [expo, context] = await Promise.all([
    getExpoUsagePage(filters, options),
    getUsageContext(options),
  ]);
  return { expo, context };
}
