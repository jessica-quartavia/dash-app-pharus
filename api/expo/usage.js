import { sendJson } from "../../lib/http.mjs";
import { buildExpoUsageDataset } from "../../lib/expo/usage-page.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Método não permitido.", code: "METHOD_NOT_ALLOWED" });
    return;
  }

  try {
    const url = new URL(req.url || "/", "http://localhost");
    const filters = {
      startDate: url.searchParams.get("startDate"),
      endDate: url.searchParams.get("endDate"),
      period: url.searchParams.get("period"),
    };
    const payload = await buildExpoUsageDataset(filters);
    const status = payload.available ? 200 : 503;
    sendJson(
      res,
      status,
      {
        ...payload,
        available: payload.available,
        error: payload.available ? null : payload.userMessage,
      },
      { "Cache-Control": "private, max-age=120" },
    );
  } catch {
    sendJson(
      res,
      503,
      {
        available: false,
        error: "Integração com Expo em configuração",
        userMessage: "Integração com Expo em configuração",
        integration: { authenticated: false, projectResolved: false },
        kpis: [],
        builds: [],
        channels: [],
        usageSeries: [],
        platformSplit: [],
        versionRows: [],
        updates: [],
      },
      { "Cache-Control": "no-store" },
    );
  }
}
