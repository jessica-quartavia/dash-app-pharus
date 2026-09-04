import { authenticatedFetch } from "../../auth.mjs";
import { readApiJson } from "../../lib/api-json.mjs";
import { presentCsatPage } from "../../../lib/app-pharus/present-csat.mjs";

const TTL_MS = 60_000;
let cache = { at: 0, data: null };

export async function getCsatDataset({ force = false } = {}) {
  if (!force && cache.data && Date.now() - cache.at < TTL_MS) return cache.data;
  const response = await authenticatedFetch("/api/csat", { cache: "no-store" });
  const data = await readApiJson(response, "Não foi possível carregar o CSAT.");
  cache = { at: Date.now(), data };
  return data;
}

export async function getCsatPage(filters, options = {}) {
  const dataset = await getCsatDataset(options);
  return presentCsatPage(dataset, filters);
}
