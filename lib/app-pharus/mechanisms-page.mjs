/**
 * Página Mecanismos — dataset server-side sobre a população oficial.
 */
import { timestampToIsoDate } from "../../js/lib/filters/period.mjs";
import { getDataRestConfig } from "../data/pharus-rest.mjs";
import {
  OFFICIAL_CLIENT_RULE,
  PHARUS_DATA_PROJECT,
  displayClientName,
  indexByUserId,
  officialIdSet,
} from "./clients.mjs";
import {
  catalogFromRow,
  clientMechanismDates,
  clientMechanismsLists,
  countsPerOfficialClient,
  uniqueImplementedRecords,
} from "./mechanisms.mjs";
import { fetchCoreColumns, fetchOfficialUsers } from "./queries.mjs";

export { presentMechanismsPage } from "./present-mechanisms.mjs";

function requireServiceRole() {
  const cfg = getDataRestConfig();
  if (!cfg.ok) {
    const err = new Error(cfg.error);
    err.code = cfg.code || "data_config";
    throw err;
  }
  if (cfg.authMode !== "service_role") {
    const err = new Error("/api/mechanisms recusou anon key. Tabelas com RLS devolvem 0 linhas, não ausência de dados.");
    err.code = "anon_not_allowed";
    throw err;
  }
  return cfg;
}

export async function buildMechanismsDataset() {
  const cfg = requireServiceRole();
  const officialFetch = await fetchOfficialUsers();
  const users = officialFetch.rows;
  const officialSet = officialIdSet(users);

  const [catalogRows, userMechanisms, profiles] = await Promise.all([
    fetchCoreColumns("mechanisms", "id,data"),
    fetchCoreColumns("user_mechanisms", "user_id,mechanism_id,status,created_at"),
    fetchCoreColumns("personal_info", "user_id,name"),
  ]);

  const catalog = (catalogRows || []).map(catalogFromRow).filter((item) => item.id);
  catalog.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const implementations = uniqueImplementedRecords(userMechanisms || [], officialSet);
  const counts = countsPerOfficialClient(implementations, officialSet);
  const dates = clientMechanismDates(implementations);
  const mechanismsByClient = clientMechanismsLists(implementations, catalog);
  const profileMap = indexByUserId(profiles || []);
  const available = catalog.length;

  const clients = users.map((user) => {
    const id = String(user.id);
    const implemented = counts.get(id) || 0;
    const range = dates.get(id);
    return {
      id,
      name: displayClientName(user, profileMap.get(id)),
      email: String(user.email || "").trim(),
      registeredAt: timestampToIsoDate(user.created_at),
      createdAt: user.created_at || null,
      hasMechanisms: implemented > 0,
      mechanismsAvailable: available,
      mechanismsImplemented: implemented,
      mechanismRate: available ? (implemented / available) * 100 : 0,
      firstMechanismAt: range?.first || null,
      lastMechanismAt: range?.last || null,
      mechanismUpdatedAt: range?.last || null,
      mechanisms: mechanismsByClient.get(id) || [],
    };
  });
  clients.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return {
    source: {
      projectId: cfg.projectId || PHARUS_DATA_PROJECT,
      schema: "core",
      authMode: cfg.authMode,
      officialSource: officialFetch.source,
    },
    clientBase: {
      found: clients.length > 0,
      table: "auth.users",
      key: "id",
      total: clients.length,
      view: officialFetch.source,
      rule: OFFICIAL_CLIENT_RULE.sql,
      reason: OFFICIAL_CLIENT_RULE.description,
    },
    populationTotal: clients.length,
    catalog,
    implementations: implementations.map((row) => ({
      user_id: row.user_id,
      mechanism_id: row.mechanism_id,
      created_at: row.created_at,
    })),
    clients,
    methodology:
      "Mecanismos implementados na base oficial do App Pharus. Cobertura = clientes com pelo menos um mecanismo sobre o total do recorte.",
  };
}
