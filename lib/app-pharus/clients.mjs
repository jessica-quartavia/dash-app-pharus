/**
 * População oficial de clientes do App Pharus.
 * Fonte: auth.users via Auth Admin API. Mesma regra para Visão Geral e Clientes.
 */
export const PHARUS_DATA_PROJECT = "qvtqufdivpbmubooawdm";

export const OFFICIAL_CLIENT_SQL = `
deleted_at IS NULL
AND raw_app_meta_data->>'role' = 'member'
AND COALESCE(email, '') NOT ILIKE '%@demo.com.br'
AND COALESCE(email, '') NOT ILIKE '%@quartavia.com.br'
`.trim();

export const OFFICIAL_CLIENT_RULE = {
  project: PHARUS_DATA_PROJECT,
  schema: "auth",
  table: "users",
  key: "id",
  sql: OFFICIAL_CLIENT_SQL,
  description:
    "Usuários do App Pharus (auth.users): não excluídos, role member, excluindo @demo.com.br e @quartavia.com.br. Chave = auth.users.id = core.*.user_id. core.personal_info é o perfil 1:1, não a população.",
};

/** Estágios reais de metrics.v_current_stage (CASE sobre user_progress). Só enriquecimento, não a listagem. */
export const OFFICIAL_JOURNEY_STAGES = [
  "Onboarding",
  "Diagnóstico completo",
  "Onboarding Concluído",
  "Mapeamento Patrimonial",
  "Ativação das Engrenagens",
  "Central de Inteligência",
];

function parseMeta(value) {
  if (value && typeof value === "object") return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function appMetaOf(user) {
  return parseMeta(user?.raw_app_meta_data || user?.app_metadata);
}

export function userMetaOf(user) {
  return parseMeta(user?.raw_user_meta_data || user?.user_metadata);
}

function hasDeletedAt(user) {
  const value = user?.deleted_at;
  return value != null && String(value).trim() !== "";
}

function excludedEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return value.endsWith("@demo.com.br") || value.endsWith("@quartavia.com.br");
}

/**
 * Regra central da população oficial.
 * Aceita o formato SQL (raw_app_meta_data) e o da Auth Admin API (app_metadata).
 */
export function isOfficialPharusClient(user) {
  if (!user || hasDeletedAt(user)) return false;
  if (appMetaOf(user).role !== "member") return false;
  if (excludedEmail(user.email)) return false;
  return true;
}

export const isOfficialClient = isOfficialPharusClient;

export function classifyAuthUsers(users) {
  const list = users || [];
  let notDeleted = 0;
  let members = 0;
  const officialUsers = [];
  for (const user of list) {
    const alive = !hasDeletedAt(user);
    if (alive) notDeleted += 1;
    if (alive && appMetaOf(user).role === "member") members += 1;
    if (isOfficialPharusClient(user)) officialUsers.push(user);
  }
  return {
    received: list.length,
    notDeleted,
    members,
    afterDomainExclusion: officialUsers.length,
    official: officialUsers.length,
    officialUsers,
  };
}

export function logOfficialPopulationDebug(counts) {
  console.info(`[clients] Auth users recebidos: ${counts.received}`);
  console.info(`[clients] Não excluídos: ${counts.notDeleted}`);
  console.info(`[clients] Role member: ${counts.members}`);
  console.info(`[clients] Após excluir domínios internos/demo: ${counts.afterDomainExclusion}`);
  console.info(`[clients] População oficial: ${counts.official}`);
}

export function officialIdSet(users) {
  const set = new Set();
  for (const user of users || []) {
    if (!isOfficialPharusClient(user) || !user.id) continue;
    set.add(String(user.id));
  }
  return set;
}

export function intersectOfficial(ids, officialSet) {
  const out = new Set();
  for (const id of ids || []) {
    const key = String(id);
    if (officialSet.has(key)) out.add(key);
  }
  return out;
}

export function displayClientName(user, profile) {
  const fromProfile = String(profile?.name || "").trim();
  if (fromProfile) return fromProfile;
  const meta = userMetaOf(user);
  const fromMeta = String(meta.name || "").trim();
  if (fromMeta) return fromMeta;
  const email = String(user?.email || "").trim();
  if (email) return email;
  return "Sem nome";
}

export function userIdSet(rows, key = "user_id", officialSet = null) {
  const set = new Set();
  for (const row of rows || []) {
    const id = row?.[key];
    if (id == null) continue;
    const value = String(id);
    if (officialSet && !officialSet.has(value)) continue;
    set.add(value);
  }
  return set;
}

export function indexByUserId(rows, key = "user_id") {
  const map = new Map();
  for (const row of rows || []) {
    if (row?.[key] == null) continue;
    map.set(String(row[key]), row);
  }
  return map;
}
