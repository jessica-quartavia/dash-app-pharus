import { buildGa4UsageDataset } from "../../lib/firebase-analytics/usage.mjs";
import { sendJson } from "../../lib/http.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Método não permitido.", code: "METHOD_NOT_ALLOWED" });
    return;
  }

  try {
    const url = new URL(req.url || "/", "http://localhost");
    const payload = await buildGa4UsageDataset({
      startDate: url.searchParams.get("startDate"),
      endDate: url.searchParams.get("endDate"),
    });
    sendJson(res, payload.available ? 200 : 503, { ...payload, error: payload.available ? null : payload.userMessage }, { "Cache-Control": "private, max-age=600" });
  } catch {
    sendJson(res, 503, { available: false, error: "Firebase Analytics temporariamente indisponível.", userMessage: "Firebase Analytics temporariamente indisponível.", integration: { authenticated: false, propertyResolved: false }, kpis: [], usageSeries: [], platformSplit: [], versionRows: [], events: [] });
  }
}
