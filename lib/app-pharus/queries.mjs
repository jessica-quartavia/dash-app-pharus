/**
 * Queries somente leitura do App Pharus (PostgREST, server-side).
 * População oficial: Auth Admin API. Schema core para enriquecimento.
 * Nunca usar PostgREST schema auth /rest/v1/users — o Data API não expõe auth.users.
 */
import { listAllAuthAdminUsers } from "../data/pharus-auth-admin.mjs";
import { dataRestFetchAll } from "../data/pharus-rest.mjs";
import { classifyAuthUsers, isOfficialPharusClient } from "./clients.mjs";

export async function fetchOfficialUsers() {
  const raw = await listAllAuthAdminUsers();
  const counts = classifyAuthUsers(raw);
  const rows = counts.officialUsers.filter(isOfficialPharusClient);
  return {
    source: "auth.admin.listUsers",
    key: "id",
    rows,
    fetched: counts.received,
    counts,
  };
}

export async function fetchOfficialClientRows() {
  return fetchOfficialUsers();
}

export async function fetchCoreColumns(table, select) {
  return dataRestFetchAll(table, select, { schema: "core" });
}

export async function fetchCoreColumnsSafe(table, select) {
  try {
    const rows = await fetchCoreColumns(table, select);
    return { ok: true, table, rows, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[clients] core.${table} falhou:`, message);
    return { ok: false, table, rows: [], error: message };
  }
}

export async function fetchBackofficeColumns(table, select) {
  return dataRestFetchAll(table, select, { schema: "backoffice" });
}

export async function fetchBackofficeColumnsSafe(table, select) {
  try {
    const rows = await fetchBackofficeColumns(table, select);
    return { ok: true, table, rows, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[clients] backoffice.${table} falhou:`, message);
    return { ok: false, table, rows: [], error: message };
  }
}

export async function fetchCurrentStages() {
  try {
    return await dataRestFetchAll("v_current_stage", "user_id,current_stage", { schema: "metrics" });
  } catch {
    return [];
  }
}

export async function fetchCurrentStagesSafe() {
  try {
    const rows = await dataRestFetchAll("v_current_stage", "user_id,current_stage", { schema: "metrics" });
    return { ok: true, table: "v_current_stage", rows, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[clients] metrics.v_current_stage falhou:", message);
    return { ok: false, table: "v_current_stage", rows: [], error: message };
  }
}

export const WEALTH_ASSET_TABLES = [
  "equities",
  "fixed_income",
  "investment_funds",
  "private_pensions",
  "other_investments",
  "real_estate_assets",
  "movable_assets",
  "consortia",
];

export const WEALTH_LIABILITY_TABLES = ["financings", "loans"];
