/**
 * Auth Admin do projeto de DADOS (App Pharus). Somente backend.
 * Nunca expor DATA_SUPABASE_SERVICE_ROLE_KEY. Não usar AUTH_SUPABASE_URL.
 */
import { createClient } from "@supabase/supabase-js";
import { PHARUS_DEFAULT_URL } from "../env.mjs";
import { getDataRestConfig } from "./pharus-rest.mjs";

export const AUTH_ADMIN_PAGE_SIZE = 1000;
export const AUTH_ADMIN_MAX_PAGES = 50;

export function parseAdminUsersPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.users)) return payload.users;
  return [];
}

export function normalizeAuthAdminUser(user) {
  if (!user || typeof user !== "object") return null;
  const appMeta = user.app_metadata || user.raw_app_meta_data || {};
  const userMeta = user.user_metadata || user.raw_user_meta_data || {};
  return {
    id: user.id,
    email: user.email ?? "",
    created_at: user.created_at || null,
    deleted_at: user.deleted_at || null,
    raw_app_meta_data: appMeta,
    raw_user_meta_data: userMeta,
    app_metadata: appMeta,
    user_metadata: userMeta,
  };
}

export function createPharusAdminClient() {
  const cfg = getDataRestConfig();
  if (!cfg.ok) {
    const err = new Error(cfg.error);
    err.code = cfg.code || "data_config";
    throw err;
  }
  if (cfg.authMode !== "service_role") {
    const err = new Error("Auth Admin exige DATA_SUPABASE_SERVICE_ROLE_KEY no servidor.");
    err.code = "anon_not_allowed";
    throw err;
  }
  const url = cfg.url || PHARUS_DEFAULT_URL;
  if (!String(url).includes("qvtqufdivpbmubooawdm")) {
    const err = new Error("DATA_SUPABASE_URL não aponta para o projeto de dados do App Pharus.");
    err.code = "data_project_mismatch";
    throw err;
  }
  return createClient(url, cfg.restKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function listAllAuthAdminUsers() {
  const supabase = createPharusAdminClient();
  const users = [];
  for (let page = 1; page <= AUTH_ADMIN_MAX_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: AUTH_ADMIN_PAGE_SIZE,
    });
    if (error) {
      const err = new Error(`Auth Admin listUsers: ${error.message || "falhou"}`);
      err.code = "auth_admin_error";
      err.status = error.status || 500;
      throw err;
    }
    const batch = parseAdminUsersPayload(data);
    users.push(...batch);
    if (batch.length < AUTH_ADMIN_PAGE_SIZE) break;
  }
  return users.map(normalizeAuthAdminUser).filter(Boolean);
}
