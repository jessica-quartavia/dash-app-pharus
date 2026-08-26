import { authenticatedFetch } from "../../auth.mjs";
import { presentMechanismsPage } from "../../../lib/app-pharus/present-mechanisms.mjs";
import { readApiJson } from "../../lib/api-json.mjs";

let cache = { at: 0, data: null };
const TTL_MS = 30_000;

export async function getMechanismsDataset({ force = false } = {}) {
  if (!force && cache.data && Date.now() - cache.at < TTL_MS) return cache.data;
  const response = await authenticatedFetch("/api/mechanisms", { cache: "no-store" });
  const payload = await readApiJson(response, "Não foi possível carregar os mecanismos.");
  if (!Array.isArray(payload.clients) || !Array.isArray(payload.implementations) || !Array.isArray(payload.catalog)) {
    const err = new Error("A API de mecanismos não devolveu o dataset oficial.");
    err.code = "MECHANISMS_PAYLOAD_INVALID";
    throw err;
  }
  cache = { at: Date.now(), data: payload };
  return payload;
}

export async function getMechanismsPage(filters, { force = false } = {}) {
  const dataset = await getMechanismsDataset({ force });
  return presentMechanismsPage(dataset, filters);
}
