import { authenticatedFetch } from "../../auth.mjs";
import { presentClientsPage } from "../../../lib/app-pharus/present-clients.mjs";
import { readApiJson } from "../../lib/api-json.mjs";

let cache = { at: 0, data: null };
const TTL_MS = 30_000;

export async function getClientsDataset({ force = false } = {}) {
  if (!force && cache.data && Date.now() - cache.at < TTL_MS) return cache.data;
  const response = await authenticatedFetch("/api/clients", { cache: "no-store" });
  const payload = await readApiJson(response, "Não foi possível carregar os clientes.");
  if (!Array.isArray(payload.clients)) {
    const err = new Error("A API de clientes não devolveu a lista oficial.");
    err.code = "CLIENTS_PAYLOAD_INVALID";
    throw err;
  }
  cache = { at: Date.now(), data: payload };
  return payload;
}

export async function getClientsPage(filters, { force = false } = {}) {
  const dataset = await getClientsDataset({ force });
  return presentClientsPage(dataset, filters);
}

export async function getClientById(id, { force = false } = {}) {
  const dataset = await getClientsDataset({ force });
  const key = String(id || "");
  return (dataset.clients || []).find((client) => String(client.id) === key) || null;
}
