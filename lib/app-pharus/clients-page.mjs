/**
 * Página Clientes — dataset server-side.
 * Auth Admin é crítico. Enriquecimento core.* é LEFT JOIN lógico e isolado.
 */
import {
  OFFICIAL_CLIENT_RULE,
  PHARUS_DATA_PROJECT,
  logOfficialPopulationDebug,
  officialIdSet,
  userIdSet,
  indexByUserId,
} from "./clients.mjs";
import { assembleOfficialClients } from "./present-clients.mjs";
import { getDataRestConfig } from "../data/pharus-rest.mjs";
import {
  WEALTH_ASSET_TABLES,
  fetchBackofficeColumnsSafe,
  fetchCoreColumnsSafe,
  fetchCurrentStagesSafe,
  fetchOfficialUsers,
} from "./queries.mjs";
import { buildCustomerAdvisorMap, listAdvisorOptions } from "./advisors.mjs";
import { countsPerOfficialClient, uniqueImplementedRecords } from "./mechanisms.mjs";
import {
  buildLastOperationalActivityMap,
  stepCompleteIds,
} from "./operational-activity.mjs";

export { assembleOfficialClients, presentClientsPage } from "./present-clients.mjs";

let clientsCache = { at: 0, data: null, pending: null };
const CLIENTS_CACHE_MS = 5 * 60 * 1000;

function requireServiceRole() {
  const cfg = getDataRestConfig();
  if (!cfg.ok) {
    const err = new Error(cfg.error);
    err.code = cfg.code || "data_config";
    throw err;
  }
  if (cfg.authMode !== "service_role") {
    const err = new Error("/api/clients recusou anon key. Tabelas com RLS devolvem 0 linhas, não ausência de dados.");
    err.code = "anon_not_allowed";
    throw err;
  }
  return cfg;
}

function sourceOk(entry) {
  return entry?.ok !== false;
}

export async function buildClientsDataset({ force = false } = {}) {
  const now = Date.now();
  if (!force && clientsCache.data && now - clientsCache.at < CLIENTS_CACHE_MS) return clientsCache.data;
  if (!force && clientsCache.pending) return clientsCache.pending;
  const pending = buildClientsDatasetUncached();
  clientsCache.pending = pending;
  try {
    const data = await pending;
    clientsCache = { at: Date.now(), data, pending: null };
    return data;
  } catch (error) {
    clientsCache.pending = null;
    throw error;
  }
}

async function buildClientsDatasetUncached() {
  const cfg = requireServiceRole();
  const officialFetch = await fetchOfficialUsers();
  if (officialFetch.counts) logOfficialPopulationDebug(officialFetch.counts);
  const users = officialFetch.rows;
  const officialSet = officialIdSet(users);

  const [
    profiles,
    stages,
    connections,
    formSubmissions,
    scheduledMeetings,
    userMechanisms,
    userProgress,
    userEngines,
    allocations,
    internalProfiles,
    ...wealthTables
  ] = await Promise.all([
    fetchCoreColumnsSafe("personal_info", "user_id,name"),
    fetchCurrentStagesSafe(),
    fetchCoreColumnsSafe("connections", "user_id,is_open_finance,item_status"),
    fetchCoreColumnsSafe("form_submissions", "user_id,submitted_at"),
    fetchCoreColumnsSafe("scheduled_meetings", "user_id,status,start_time"),
    fetchCoreColumnsSafe("user_mechanisms", "user_id,mechanism_id,status,created_at"),
    fetchCoreColumnsSafe("user_progress", "user_id,step,completed_at,created_at"),
    fetchCoreColumnsSafe("user_engines", "user_id,income,reserve,contribution"),
    fetchBackofficeColumnsSafe("internals_customers_allocations", "customer_id,internal_id"),
    fetchBackofficeColumnsSafe("internal_profile", "internal_id,name"),
    ...WEALTH_ASSET_TABLES.map((table) => fetchCoreColumnsSafe(table, "user_id")),
  ]);

  const enrichment = {
    personal_info: sourceOk(profiles) ? "ok" : profiles.error,
    connections: sourceOk(connections) ? "ok" : connections.error,
    user_mechanisms: sourceOk(userMechanisms) ? "ok" : userMechanisms.error,
    user_progress: sourceOk(userProgress) ? "ok" : userProgress.error,
    form_submissions: sourceOk(formSubmissions) ? "ok" : formSubmissions.error,
    scheduled_meetings: sourceOk(scheduledMeetings) ? "ok" : scheduledMeetings.error,
    v_current_stage: sourceOk(stages) ? "ok" : stages.error,
    user_engines: sourceOk(userEngines) ? "ok" : userEngines.error,
    advisors: sourceOk(allocations) && sourceOk(internalProfiles) ? "ok" : "partial",
    wealth: wealthTables.every((item) => sourceOk(item))
      ? "ok"
      : wealthTables.find((item) => !sourceOk(item))?.error || "falhou",
  };

  const wealthIds = new Set();
  if (enrichment.wealth === "ok") {
    for (const item of wealthTables) {
      userIdSet(item.rows, "user_id", officialSet).forEach((id) => wealthIds.add(id));
    }
  }

  const ofRows = sourceOk(connections)
    ? (connections.rows || []).filter((row) => row.is_open_finance === true && row.item_status === "UPDATED")
    : [];
  const ofIds = userIdSet(ofRows, "user_id", officialSet);
  const mechanismRecords = uniqueImplementedRecords(sourceOk(userMechanisms) ? userMechanisms.rows : [], officialSet);
  const mechanismIds = new Set(mechanismRecords.map((row) => row.user_id));
  const mechanismCounts = countsPerOfficialClient(mechanismRecords, officialSet);
  const meetingIds = userIdSet(
    sourceOk(scheduledMeetings)
      ? (scheduledMeetings.rows || []).filter((row) => String(row.status) === "completed")
      : [],
    "user_id",
    officialSet,
  );
  const formIds = userIdSet(
    sourceOk(formSubmissions) ? (formSubmissions.rows || []).filter((row) => row.submitted_at) : [],
    "user_id",
    officialSet,
  );
  const journeyIds = userIdSet(sourceOk(userProgress) ? userProgress.rows : [], "user_id", officialSet);
  const progressRows = sourceOk(userProgress) ? userProgress.rows : [];
  const onboardingIds = stepCompleteIds(progressRows, "complete", officialSet);
  const personalDataIds = stepCompleteIds(progressRows, "personal_data", officialSet);
  const lastOperationalActivity = buildLastOperationalActivityMap({
    userProgress: progressRows,
    formSubmissions: sourceOk(formSubmissions) ? formSubmissions.rows : [],
    scheduledMeetings: sourceOk(scheduledMeetings) ? scheduledMeetings.rows : [],
    userMechanisms: sourceOk(userMechanisms) ? userMechanisms.rows : [],
    officialSet,
  });

  const advisorMap =
    sourceOk(allocations) && sourceOk(internalProfiles)
      ? buildCustomerAdvisorMap(allocations.rows, internalProfiles.rows)
      : new Map();
  const engineMap = indexByUserId(sourceOk(userEngines) ? userEngines.rows : [], "user_id");
  const advisors = sourceOk(allocations) && sourceOk(internalProfiles)
    ? listAdvisorOptions(allocations.rows, internalProfiles.rows)
    : [];

  const clients = assembleOfficialClients({
    users,
    profiles: sourceOk(profiles) ? profiles.rows : [],
    stages: sourceOk(stages) ? stages.rows : [],
    wealthIds,
    ofIds,
    mechanismIds,
    mechanismCounts,
    meetingIds,
    formIds,
    journeyIds,
    onboardingIds,
    personalDataIds,
    lastOperationalActivity,
    advisorMap,
    engineMap,
    sources: {
      wealth: enrichment.wealth === "ok",
      connections: enrichment.connections === "ok",
      user_mechanisms: enrichment.user_mechanisms === "ok",
      scheduled_meetings: enrichment.scheduled_meetings === "ok",
      form_submissions: enrichment.form_submissions === "ok",
      user_progress: enrichment.user_progress === "ok",
      v_current_stage: enrichment.v_current_stage === "ok",
      user_engines: enrichment.user_engines === "ok",
    },
  });

  const populationTotal = clients.length;

  return {
    source: {
      projectId: cfg.projectId || PHARUS_DATA_PROJECT,
      schema: "core",
      authMode: cfg.authMode,
      officialSource: officialFetch.source,
      authUsersReceived: officialFetch.counts?.received ?? officialFetch.fetched,
    },
    clientBase: {
      found: clients.length > 0,
      table: "auth.users",
      key: "id",
      total: populationTotal,
      view: officialFetch.source,
      rule: OFFICIAL_CLIENT_RULE.sql,
      reason: OFFICIAL_CLIENT_RULE.description,
    },
    populationTotal,
    filteredTotal: populationTotal,
    advisors,
    enrichment,
    clients,
    methodology:
      "Base oficial do App Pharus. O período filtra a data de cadastro (auth.users.created_at). Segmentação via core.user_engines. EP via backoffice.internals_customers_allocations.",
  };
}
