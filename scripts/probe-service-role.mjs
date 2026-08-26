/**
 * Diagnóstico server-side: ANON vs SERVICE ROLE no projeto de dados.
 * Nunca imprime chaves.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(ROOT);

const EXPECTED_REF = "qvtqufdivpbmubooawdm";
const EXPECTED_URL = `https://${EXPECTED_REF}.supabase.co`;

function jwtClaims(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return { ok: false, reason: "not_jwt", parts: parts.length };
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return {
      ok: true,
      iss: payload.iss || null,
      ref: payload.ref || null,
      role: payload.role || null,
      exp: payload.exp || null,
      iat: payload.iat || null,
      expired: payload.exp ? payload.exp * 1000 < Date.now() : null,
    };
  } catch {
    return { ok: false, reason: "payload_unreadable" };
  }
}

function classifyError(status, body, rowCount) {
  const message = body?.message || body?.error_description || body?.error || null;
  const code = body?.code || null;
  const text = `${status} ${message || ""} ${code || ""}`.toLowerCase();
  if (status === 401 || status === 403) {
    if (text.includes("invalid") || text.includes("jwt") || text.includes("signature")) return "chave_invalida_ou_assinatura";
    if (text.includes("expired")) return "chave_expirada";
    return "nao_autorizado";
  }
  if (status === 404 || code === "PGRST106" || text.includes("schema") || text.includes("search path")) {
    return "schema_ou_recurso";
  }
  if (status === 200 && rowCount === 0) return "vazio_ou_rls";
  if (status >= 200 && status < 300 && rowCount > 0) return "ok";
  return "outro";
}

async function probe({ label, url, key, schema, table, select }) {
  const endpoint = new URL(`/rest/v1/${table}`, url);
  endpoint.searchParams.set("select", select);
  endpoint.searchParams.set("limit", "1");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    Prefer: "count=exact",
  };
  if (schema) {
    headers["Accept-Profile"] = schema;
    headers["Content-Profile"] = schema;
  }

  const started = Date.now();
  let response;
  try {
    response = await fetch(endpoint, { method: "GET", headers });
  } catch (error) {
    return {
      label,
      roleUsed: label,
      schema: schema || "(default)",
      table,
      httpStatus: null,
      networkError: error instanceof Error ? error.message : String(error),
      rowCount: null,
      contentRange: null,
      error: null,
      classification: "rede",
      ms: Date.now() - started,
    };
  }

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { parseError: true, preview: text.slice(0, 180) };
  }
  const rows = Array.isArray(parsed) ? parsed : [];
  const range = response.headers.get("content-range");
  const totalMatch = range && range.match(/\/(\d+|\*)\s*$/);
  const exactTotal = totalMatch && totalMatch[1] !== "*" ? Number(totalMatch[1]) : null;
  const errorBody = Array.isArray(parsed) ? null : parsed;
  const rowCount = exactTotal ?? rows.length;

  return {
    label,
    roleUsed: label,
    schema: schema || "(PostgREST default)",
    table,
    headersSent: {
      AcceptProfile: schema || null,
      ContentProfile: schema || null,
      Prefer: "count=exact",
      Authorization: "Bearer [redacted]",
      apikey: "[redacted]",
    },
    httpStatus: response.status,
    contentRange: range,
    rowCount,
    pageLength: rows.length,
    error: errorBody
      ? {
          code: errorBody.code || null,
          message: errorBody.message || errorBody.error || null,
          details: errorBody.details || null,
          hint: errorBody.hint || null,
        }
      : null,
    classification: classifyError(response.status, errorBody, exactTotal ?? rows.length),
    ms: Date.now() - started,
  };
}

const url = String(process.env.DATA_SUPABASE_URL || "").trim().replace(/\/$/, "");
const anon = String(process.env.DATA_SUPABASE_ANON_KEY || "").trim();
const service = String(process.env.DATA_SUPABASE_SERVICE_ROLE_KEY || "").trim();
const schema = String(process.env.DATA_SUPABASE_SCHEMA || "core").trim();

const envReport = {
  DATA_SUPABASE_SERVICE_ROLE_KEY_configured: Boolean(service),
  DATA_SUPABASE_SERVICE_ROLE_KEY_length: service.length,
  DATA_SUPABASE_ANON_KEY_configured: Boolean(anon),
  DATA_SUPABASE_ANON_KEY_length: anon.length,
  DATA_SUPABASE_URL: url,
  DATA_SUPABASE_URL_matches_expected: url === EXPECTED_URL,
  DATA_SUPABASE_SCHEMA: schema,
  jwt: {
    anon: jwtClaims(anon),
    service_role: jwtClaims(service),
  },
};

envReport.jwt.anon.ref_matches_project = envReport.jwt.anon.ref === EXPECTED_REF;
envReport.jwt.service_role.ref_matches_project = envReport.jwt.service_role.ref === EXPECTED_REF;
envReport.jwt.anon.role_is_anon = envReport.jwt.anon.role === "anon";
envReport.jwt.service_role.role_is_service_role = envReport.jwt.service_role.role === "service_role";

const tests = [];
if (service) {
  tests.push(probe({ label: "SERVICE_ROLE", url, key: service, schema: "core", table: "personal_info", select: "user_id" }));
  tests.push(probe({ label: "SERVICE_ROLE_NO_PROFILE", url, key: service, schema: null, table: "personal_info", select: "user_id" }));
  tests.push(probe({ label: "SERVICE_ROLE_PUBLIC_PROFILE", url, key: service, schema: "public", table: "personal_info", select: "user_id" }));
  tests.push(probe({ label: "SERVICE_ROLE_USER_MECHANISMS", url, key: service, schema: "core", table: "user_mechanisms", select: "user_id" }));
}
if (anon) {
  tests.push(probe({ label: "ANON", url, key: anon, schema: "core", table: "personal_info", select: "user_id" }));
  tests.push(probe({ label: "ANON_USER_MECHANISMS", url, key: anon, schema: "core", table: "user_mechanisms", select: "user_id" }));
}

const results = await Promise.all(tests);
const personalInfo = {
  ANON: results.find((item) => item.label === "ANON") || null,
  SERVICE_ROLE: results.find((item) => item.label === "SERVICE_ROLE") || null,
};

console.log(
  JSON.stringify(
    {
      env: envReport,
      personal_info: personalInfo,
      extra: results.filter((item) => item.label !== "ANON" && item.label !== "SERVICE_ROLE"),
    },
    null,
    2,
  ),
);
