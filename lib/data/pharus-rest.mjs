/**
 * Leitura REST do App Pharus — somente backend.
 * Usa DATA_SUPABASE_*. Nunca envia JWT do projeto Auth.
 */
import { dataConfigurationError, getDataEnv, inspectJwtClaims, PHARUS_PROJECT_ID } from "../env.mjs";

export const DATA_DEFAULT_TIMEOUT_MS = 25_000;

export function getDataRestConfig({ requireServiceRole = true } = {}) {
  const error = dataConfigurationError();
  if (error) return { ok: false, error, code: "data_config" };
  const env = getDataEnv();

  if (requireServiceRole) {
    if (!env.serviceRoleKey) {
      return {
        ok: false,
        code: "service_role_required",
        error:
          "DATA_SUPABASE_SERVICE_ROLE_KEY ausente no servidor. A anon key não é usada como fallback em tabelas com RLS.",
      };
    }
    const claims = inspectJwtClaims(env.serviceRoleKey);
    if (!claims.ok) {
      return { ok: false, code: "service_role_invalid", error: "DATA_SUPABASE_SERVICE_ROLE_KEY não é um JWT legível." };
    }
    if (claims.role !== "service_role") {
      return {
        ok: false,
        code: "service_role_invalid",
        error: "DATA_SUPABASE_SERVICE_ROLE_KEY não tem a role service_role.",
      };
    }
    if (claims.ref && claims.ref !== PHARUS_PROJECT_ID) {
      return {
        ok: false,
        code: "service_role_project_mismatch",
        error: `A service role não pertence ao projeto ${PHARUS_PROJECT_ID}.`,
      };
    }
    if (claims.expired) {
      return { ok: false, code: "service_role_expired", error: "DATA_SUPABASE_SERVICE_ROLE_KEY expirada." };
    }
    return {
      ok: true,
      url: env.url,
      restKey: env.serviceRoleKey,
      schema: env.schema,
      authMode: "service_role",
      projectId: env.projectId,
      jwtRole: claims.role,
      jwtRef: claims.ref,
    };
  }

  return {
    ok: false,
    code: "anon_not_allowed",
    error: "Consultas analíticas não usam DATA_SUPABASE_ANON_KEY. Tabelas com RLS devolveriam HTTP 200 com 0 linhas.",
  };
}

function buildHeaders(restKey, schema, { countExact = false, head = false } = {}) {
  const headers = {
    apikey: restKey,
    Authorization: `Bearer ${restKey}`,
    Accept: "application/json",
    "Accept-Profile": schema,
    "Content-Profile": schema,
  };
  if (countExact || head) headers.Prefer = "count=exact";
  if (head) headers.Range = "0-0";
  return headers;
}

function parseBody(text) {
  if (!text) return [];
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : data == null ? [] : [data];
  } catch {
    return [];
  }
}

function parseError(text) {
  try {
    const parsed = JSON.parse(text || "{}");
    return {
      code: parsed.code || null,
      message: parsed.message || null,
      details: parsed.details || null,
      hint: parsed.hint || null,
    };
  } catch {
    return { code: null, message: (text || "").slice(0, 240) || null, details: null, hint: null };
  }
}

export async function dataRestFetch(
  table,
  {
    schema,
    select = "*",
    filters = {},
    limit = null,
    offset = null,
    countExact = false,
    head = false,
    timeoutMs = DATA_DEFAULT_TIMEOUT_MS,
  } = {},
) {
  const cfg = getDataRestConfig();
  if (!cfg.ok) {
    const err = new Error(cfg.error);
    err.code = "data_config";
    throw err;
  }
  const targetSchema = schema || cfg.schema || "core";
  const endpoint = new URL(`/rest/v1/${table}`, cfg.url);
  endpoint.searchParams.set("select", select);
  for (const [key, value] of Object.entries(filters || {})) {
    if (value == null || value === "") continue;
    endpoint.searchParams.set(key, String(value));
  }
  if (limit != null) endpoint.searchParams.set("limit", String(limit));
  if (offset != null) endpoint.searchParams.set("offset", String(offset));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: buildHeaders(cfg.restKey, targetSchema, { countExact, head }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      const err = new Error(`${targetSchema}.${table}: timeout após ${timeoutMs}ms`);
      err.code = "data_timeout";
      err.status = 504;
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const bodyText = await response.text().catch(() => "");
  const contentRange = response.headers.get("content-range") || "";
  const totalMatch = contentRange.match(/\/(\d+|\*)\s*$/);
  const total = totalMatch && totalMatch[1] !== "*" ? Number(totalMatch[1]) : null;

  return {
    ok: response.ok,
    status: response.status,
    data: head ? [] : parseBody(bodyText),
    raw: bodyText,
    total,
    schema: targetSchema,
    table,
    postgrest: parseError(bodyText),
    authMode: cfg.authMode,
  };
}

export async function dataRestFetchAll(
  table,
  select = "*",
  { schema, filters = {}, pageSize = 1000, maxRows = 200_000 } = {},
) {
  const rows = [];
  let offset = 0;
  while (offset < maxRows) {
    const page = await dataRestFetch(table, {
      schema,
      select,
      filters,
      limit: pageSize,
      offset,
      countExact: offset === 0,
    });
    if (!page.ok) {
      const err = new Error(`${page.schema}.${table}: HTTP ${page.status} ${page.postgrest?.message || ""}`.trim());
      err.status = page.status;
      err.code = page.postgrest?.code || "data_rest_error";
      err.postgrest = page.postgrest;
      throw err;
    }
    rows.push(...page.data);
    if (page.data.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

export async function dataRestCount(table, { schema, filters = {} } = {}) {
  const page = await dataRestFetch(table, { schema, select: "*", filters, head: true, countExact: true });
  return page;
}
