/**
 * Diagnóstico somente leitura de /api/clients e Auth Admin.
 * Não imprime tokens. Não altera o app.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { getDataRestConfig } from "../lib/data/pharus-rest.mjs";
import { listAllAuthAdminUsers } from "../lib/data/pharus-auth-admin.mjs";
import { classifyAuthUsers } from "../lib/app-pharus/clients.mjs";
import { fetchCoreColumns, fetchCurrentStages, WEALTH_ASSET_TABLES } from "../lib/app-pharus/queries.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(ROOT);

function stage(name, ok, extra = {}) {
  console.log(JSON.stringify({ stage: name, ok, ...extra }));
}

async function timed(name, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    stage(name, true, { ms: Date.now() - started, ...result });
    return result;
  } catch (error) {
    stage(name, false, {
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      code: error?.code || null,
      status: error?.status || null,
      stack: error instanceof Error ? error.stack.split("\n").slice(0, 8) : null,
    });
    return null;
  }
}

const cfg = getDataRestConfig();
stage("data_config", cfg.ok, {
  projectId: cfg.projectId || null,
  urlHost: cfg.url ? new URL(cfg.url).host : null,
  authMode: cfg.authMode || null,
  jwtRole: cfg.jwtRole || null,
  jwtRef: cfg.jwtRef || null,
  hasServiceRole: Boolean(cfg.restKey),
  error: cfg.ok ? null : cfg.error,
  code: cfg.ok ? null : cfg.code,
});

const http = await timed("GET /api/clients sem Authorization", async () => {
  const response = await fetch("http://127.0.0.1:5173/api/clients", { cache: "no-store" });
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { parse: "not-json", preview: text.slice(0, 120) };
  }
  return {
    httpStatus: response.status,
    contentType,
    error: body?.error || null,
    code: body?.code || null,
    clientsIsArray: Array.isArray(body?.clients),
    clientsLength: Array.isArray(body?.clients) ? body.clients.length : null,
  };
});

const admin = await timed("auth.admin.listUsers isolado", async () => {
  const users = await listAllAuthAdminUsers();
  const counts = classifyAuthUsers(users);
  return {
    received: counts.received,
    notDeleted: counts.notDeleted,
    members: counts.members,
    official: counts.official,
  };
});

if (admin?.official === 400) {
  for (const table of ["personal_info", "connections", "user_mechanisms", "user_progress", "form_submissions", "scheduled_meetings"]) {
    await timed(`core.${table}`, async () => {
      const rows = await fetchCoreColumns(table, table === "personal_info" ? "user_id,name" : "user_id");
      return { rows: rows.length };
    });
  }
  await timed("metrics.v_current_stage", async () => {
    const rows = await fetchCurrentStages();
    return { rows: rows.length };
  });
  for (const table of WEALTH_ASSET_TABLES) {
    await timed(`core.${table}`, async () => {
      const rows = await fetchCoreColumns(table, "user_id");
      return { rows: rows.length };
    });
  }
}

await timed("buildClientsDataset completo", async () => {
  const { buildClientsDataset } = await import("../lib/app-pharus/clients-page.mjs");
  const dataset = await buildClientsDataset();
  return {
    total: dataset.clientBase?.total ?? null,
    clients: dataset.clients?.length ?? null,
    source: dataset.source?.officialSource ?? null,
  };
});

if (http) {
  stage("http_summary", true, http);
}
