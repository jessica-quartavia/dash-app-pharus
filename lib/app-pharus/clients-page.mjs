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
} from "./clients.mjs";
import { assembleOfficialClients } from "./present-clients.mjs";
import { getDataRestConfig } from "../data/pharus-rest.mjs";
import {
  WEALTH_ASSET_TABLES,
  fetchCoreColumnsSafe,
  fetchCurrentStagesSafe,
  fetchOfficialUsers,
} from "./queries.mjs";
import { countsPerOfficialClient, uniqueImplementedRecords } from "./mechanisms.mjs";

export { assembleOfficialClients, presentClientsPage } from "./present-clients.mjs";

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

export async function buildClientsDataset() {
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
    ...wealthTables
  ] = await Promise.all([
    fetchCoreColumnsSafe("personal_info", "user_id,name"),
    fetchCurrentStagesSafe(),
    fetchCoreColumnsSafe("connections", "user_id,is_open_finance,item_status"),
    fetchCoreColumnsSafe("form_submissions", "user_id,submitted_at"),
    fetchCoreColumnsSafe("scheduled_meetings", "user_id,status"),
    fetchCoreColumnsSafe("user_mechanisms", "user_id,mechanism_id,status"),
    fetchCoreColumnsSafe("user_progress", "user_id,step"),
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
    sources: {
      wealth: enrichment.wealth === "ok",
      connections: enrichment.connections === "ok",
      user_mechanisms: enrichment.user_mechanisms === "ok",
      scheduled_meetings: enrichment.scheduled_meetings === "ok",
      form_submissions: enrichment.form_submissions === "ok",
      user_progress: enrichment.user_progress === "ok",
      v_current_stage: enrichment.v_current_stage === "ok",
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
    enrichment,
    clients,
    methodology:
      "Base oficial do App Pharus. Clientes sem patrimônio ou Open Finance continuam na lista. O período filtra a data de cadastro. Mecanismos = pelo menos um mecanismo implementado.",
  };
}
