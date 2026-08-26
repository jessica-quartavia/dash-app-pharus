import { requireCorporateAuth } from "../lib/auth.mjs";
import { buildOverview } from "../lib/app-pharus/overview.mjs";
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
    const overview = await buildOverview();
    sendJson(res, 200, overview);
  } catch (error) {
    const code = error?.code || "overview_error";
    const status =
      code === "data_config" ||
      code === "service_role_required" ||
      code === "service_role_invalid" ||
      code === "service_role_project_mismatch" ||
      code === "service_role_expired" ||
      code === "anon_not_allowed"
        ? 503
        : 500;
    console.error("[overview]", error);
    sendJson(res, status, {
      error: error instanceof Error ? error.message : "Não foi possível montar a Visão Geral.",
      code,
    });
  }
}
