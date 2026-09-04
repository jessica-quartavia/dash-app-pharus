import { requireCorporateAuth } from "../lib/auth.mjs";
import { buildCsatDataset } from "../lib/app-pharus/csat.mjs";
import { nodeToWebRequest, sendJson } from "../lib/http.mjs";

export default async function handler(req, res) {
  const method = req.method || "GET";
  if (method !== "GET" && method !== "HEAD") {
    sendJson(res, 405, { error: "Método não permitido.", code: "METHOD_NOT_ALLOWED" });
    return;
  }

  const denied = await requireCorporateAuth(nodeToWebRequest(req));
  if (denied) {
    const payload = await denied.json().catch(() => ({ error: "Não autenticado.", code: "unauthenticated" }));
    sendJson(res, denied.status, payload);
    return;
  }

  try {
    const url = new URL(req.url || "/", "http://localhost");
    const force = url.searchParams.get("force") === "1";
    const dataset = await buildCsatDataset({ force });
    sendJson(res, 200, dataset, { "Cache-Control": "private, max-age=120" });
  } catch (error) {
    const code = error?.code || "csat_error";
    const status =
      code === "data_config" ||
      code === "service_role_required" ||
      code === "service_role_invalid" ||
      code === "service_role_project_mismatch" ||
      code === "service_role_expired" ||
      code === "anon_not_allowed"
        ? 503
        : 500;
    console.error("[csat]", error);
    sendJson(res, status, {
      error: error instanceof Error ? error.message : "Não foi possível carregar o CSAT.",
      code,
    });
  }
}
