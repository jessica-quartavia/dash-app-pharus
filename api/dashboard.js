import { requireCorporateAuth } from "../lib/auth.mjs";
import { DOMAIN_BUILDERS } from "../lib/app-pharus/domain-pages.mjs";
import { nodeToWebRequest, sendJson } from "../lib/http.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Método não permitido.", code: "METHOD_NOT_ALLOWED" });
    return;
  }
  const denied = await requireCorporateAuth(nodeToWebRequest(req));
  if (denied) {
    sendJson(res, denied.status, await denied.json().catch(() => ({ error: "Não autenticado.", code: "unauthenticated" })));
    return;
  }
  const url = new URL(req.url || "/", "http://localhost");
  const domain = url.searchParams.get("domain") || "";
  const builder = DOMAIN_BUILDERS[domain];
  if (!builder) {
    sendJson(res, 400, { error: "Domínio inválido.", code: "INVALID_DOMAIN" });
    return;
  }
  try {
    sendJson(res, 200, await builder(), { "Cache-Control": "private, max-age=300" });
  } catch (error) {
    console.error(`[dashboard:${domain}]`, error);
    sendJson(res, 503, { error: "Fonte de dados temporariamente indisponível.", code: error?.code || "DOMAIN_ERROR" });
  }
}
