import { requireCorporateAuth } from "../lib/auth.mjs";
import { buildClientsDataset } from "../lib/app-pharus/clients-page.mjs";
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
    const dataset = await buildClientsDataset();
    sendJson(res, 200, dataset);
  } catch (error) {
    const code = error?.code || "clients_error";
    const status =
      code === "data_config" ||
      code === "service_role_required" ||
      code === "service_role_invalid" ||
      code === "service_role_project_mismatch" ||
      code === "service_role_expired" ||
      code === "anon_not_allowed"
        ? 503
        : 500;
    console.error("[clients]", error);
    sendJson(res, status, {
      error: error instanceof Error ? error.message : "Não foi possível carregar os clientes.",
      code,
    });
  }
}
