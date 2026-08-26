/**
 * Variáveis de ambiente.
 * AUTH_* = login corporativo (projeto rckpuebaiswrxzmywllv).
 * DATA_* = dados do App Pharus (projeto qvtqufdivpbmubooawdm).
 * Nunca misturar JWT de Auth com a leitura analítica.
 */

export const CORPORATE_DOMAIN = "quartavia.com.br";
export const PHARUS_PROJECT_ID = "qvtqufdivpbmubooawdm";
export const PHARUS_DEFAULT_URL = "https://qvtqufdivpbmubooawdm.supabase.co";

function trimEnv(value) {
  return String(value || "").trim();
}

function trimUrl(value) {
  return trimEnv(value).replace(/\/$/, "");
}

export function getAuthEnv() {
  const url = trimUrl(process.env.AUTH_SUPABASE_URL);
  const anonKey = trimEnv(process.env.AUTH_SUPABASE_ANON_KEY);
  return { url, anonKey };
}

export function buildAuthConfigResult() {
  const { url, anonKey } = getAuthEnv();
  const headers = { "Cache-Control": "no-store" };

  if (!url || !anonKey) {
    return {
      status: 503,
      headers,
      body: {
        error: "Configuração de autenticação ausente.",
        code: "AUTH_CONFIG_MISSING",
        detail: "Configure AUTH_SUPABASE_URL e AUTH_SUPABASE_ANON_KEY no ambiente.",
      },
    };
  }

  if (!/^https:\/\//i.test(url)) {
    return {
      status: 503,
      headers,
      body: {
        error: "AUTH_SUPABASE_URL deve usar HTTPS.",
        code: "AUTH_CONFIG_INVALID",
      },
    };
  }

  if (/service_role/i.test(anonKey)) {
    return {
      status: 503,
      headers,
      body: {
        error: "Chave de serviço não pode ser exposta ao navegador. Use AUTH_SUPABASE_ANON_KEY.",
        code: "AUTH_CONFIG_INVALID",
      },
    };
  }

  return {
    status: 200,
    headers,
    body: {
      authSupabaseUrl: url,
      authSupabaseAnonKey: anonKey,
      corporateDomain: CORPORATE_DOMAIN,
    },
  };
}

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    return ref && ref !== "localhost" ? ref : null;
  } catch {
    return null;
  }
}

/** Lê claims do JWT sem devolver o token. */
export function inspectJwtClaims(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return { ok: false, reason: "not_jwt" };
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return {
      ok: true,
      iss: payload.iss || null,
      ref: payload.ref || null,
      role: payload.role || null,
      exp: payload.exp || null,
      expired: payload.exp ? payload.exp * 1000 < Date.now() : null,
    };
  } catch {
    return { ok: false, reason: "payload_unreadable" };
  }
}

/**
 * App Pharus — leitura analítica server-side.
 * Preferir DATA_SUPABASE_*; PHARUS_* permanece só como alias legado.
 */
export function getDataEnv() {
  const url = trimUrl(
    process.env.DATA_SUPABASE_URL || process.env.PHARUS_SUPABASE_URL || PHARUS_DEFAULT_URL,
  );
  const anonKey = trimEnv(
    process.env.DATA_SUPABASE_ANON_KEY || process.env.PHARUS_SUPABASE_ANON_KEY,
  );
  const serviceRoleKey = trimEnv(
    process.env.DATA_SUPABASE_SERVICE_ROLE_KEY || process.env.PHARUS_SUPABASE_SERVICE_ROLE_KEY,
  );
  const schema = trimEnv(process.env.DATA_SUPABASE_SCHEMA || process.env.PHARUS_SUPABASE_SCHEMA) || "core";
  return {
    url,
    anonKey,
    serviceRoleKey: serviceRoleKey || null,
    schema,
    projectId: projectRefFromUrl(url) || PHARUS_PROJECT_ID,
  };
}

export function dataConfigurationError() {
  const { url, anonKey, serviceRoleKey } = getDataEnv();
  const key = serviceRoleKey || anonKey;
  if (!url) return "Configure DATA_SUPABASE_URL.";
  if (!key) return "Configure DATA_SUPABASE_ANON_KEY.";
  if (!/^https:\/\//i.test(url)) return "DATA_SUPABASE_URL deve usar HTTPS.";
  return null;
}
