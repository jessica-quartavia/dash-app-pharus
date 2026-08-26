import { authenticatedFetch } from "../../auth.mjs";
import { readApiJson } from "../../lib/api-json.mjs";

export async function getOverview() {
  const response = await authenticatedFetch("/api/overview", { cache: "no-store" });
  return readApiJson(response, "Não foi possível carregar a Visão Geral.");
}
