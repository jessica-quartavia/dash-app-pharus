/** Datasets reais e somente leitura para as páginas antes alimentadas por mocks. */
import { dataRestFetchAll } from "../data/pharus-rest.mjs";
import { buildClientsDataset } from "./clients-page.mjs";

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

const ASSET_SOURCES = [
  ["equities", "Ações", "current_total_value"],
  ["fixed_income", "Renda fixa", "current_total_value"],
  ["investment_funds", "Fundos", "invested_amount"],
  ["private_pensions", "Previdência", "accumulated_value"],
  ["other_investments", "Outros investimentos", "current_value"],
  ["real_estate_assets", "Imóveis", "market_value"],
  ["movable_assets", "Bens móveis", "market_value"],
  ["consortia", "Consórcios", "total_letter_value"],
];
const LIABILITY_SOURCES = [
  ["financings", "Financiamentos", "outstanding_balance"],
  ["loans", "Empréstimos", "outstanding_balance"],
];

function clientIndex(dataset) {
  return new Map((dataset.clients || []).map((client) => [String(client.id), client]));
}

function officialRows(rows, index) {
  return (rows || []).filter((row) => index.has(String(row.user_id)));
}

function cached(name, factory, { force = false } = {}) {
  const current = cache.get(name);
  if (!force && current?.data && Date.now() - current.at < CACHE_MS) return Promise.resolve(current.data);
  if (!force && current?.pending) return current.pending;
  const pending = factory().then((data) => {
    cache.set(name, { at: Date.now(), data, pending: null });
    return data;
  }).catch((error) => {
    cache.delete(name);
    throw error;
  });
  cache.set(name, { at: 0, data: null, pending });
  return pending;
}

export function buildJourneyDataset(options = {}) {
  return cached("journey", async () => {
    const clientsDataset = await buildClientsDataset(options);
    const index = clientIndex(clientsDataset);
    const [progress, stages] = await Promise.all([
      dataRestFetchAll("user_progress", "user_id,step,created_at,completed_at", { schema: "core" }),
      dataRestFetchAll("v_current_stage", "user_id,current_stage,created_at", { schema: "metrics" }),
    ]);
    return { clients: clientsDataset.clients, advisors: clientsDataset.advisors, progress: officialRows(progress, index), stages: officialRows(stages, index), source: { schemas: ["auth", "core", "metrics"], tables: ["auth.users", "core.user_progress", "metrics.v_current_stage"] } };
  }, options);
}

export function buildMeetingsDataset(options = {}) {
  return cached("meetings", async () => {
    const clientsDataset = await buildClientsDataset(options);
    const index = clientIndex(clientsDataset);
    const [scheduled, meetings, outputs, evaluations, dimensions] = await Promise.all([
      dataRestFetchAll("scheduled_meetings", "id,user_id,meeting_id,advisor_internal_id,start_time,end_time,status,provider", { schema: "core" }),
      dataRestFetchAll("meetings", "id,meeting_title,meeting_slug,order,is_active", { schema: "core" }),
      dataRestFetchAll("meeting_outputs", "scheduled_meeting_id,user_id,notes,resume,output,created_at", { schema: "core" }),
      dataRestFetchAll("scheduled_meeting_evaluation", "scheduled_meeting_id,user_id,stars,selected_quality_slugs,other_text,created_at", { schema: "core" }),
      dataRestFetchAll("meeting_quality_dimension", "slug,label,polarity,status", { schema: "core" }),
    ]);
    const meetingIndex = new Map(meetings.map((row) => [String(row.id), row]));
    const outputGroups = new Map();
    for (const row of outputs) {
      const key = String(row.scheduled_meeting_id);
      if (!outputGroups.has(key)) outputGroups.set(key, []);
      outputGroups.get(key).push(row);
    }
    const evaluationIndex = new Map(evaluations.map((row) => [String(row.scheduled_meeting_id), row]));
    const dimensionIndex = new Map(dimensions.map((row) => [String(row.slug), row]));
    const rows = officialRows(scheduled, index).map((row) => {
      const client = index.get(String(row.user_id));
      const catalog = meetingIndex.get(String(row.meeting_id));
      const evaluation = evaluationIndex.get(String(row.id));
      const qualities = (evaluation?.selected_quality_slugs || []).map((slug) => dimensionIndex.get(String(slug))).filter(Boolean);
      const meetingOutputs = outputGroups.get(String(row.id)) || [];
      return {
        id: row.id, clientId: row.user_id, clientName: client?.name || client?.email || "Cliente sem nome",
        advisorId: row.advisor_internal_id || client?.advisorId || null, advisor: client?.advisor || null,
        meetingId: row.meeting_id, type: catalog?.meeting_title || catalog?.meeting_slug || "Não informado",
        date: row.start_time, endAt: row.end_time, status: row.status, provider: row.provider,
        score: evaluation?.stars == null ? null : Number(evaluation.stars),
        highlights: qualities.filter((item) => item.polarity === "positive").map((item) => item.label),
        attentionPoints: qualities.filter((item) => item.polarity === "negative").map((item) => item.label),
        evaluationNote: evaluation?.other_text || null,
        outputs: meetingOutputs.length,
        outputDetails: meetingOutputs.map((item) => ({ resume: item.resume, notes: item.notes, output: item.output })),
      };
    });
    return { clients: clientsDataset.clients, advisors: clientsDataset.advisors, rows, meetingTypes: meetings, source: { schemas: ["auth", "core"], tables: ["auth.users", "core.scheduled_meetings", "core.meetings", "core.meeting_outputs", "core.scheduled_meeting_evaluation", "core.meeting_quality_dimension"] } };
  }, options);
}

export function buildWealthDataset(options = {}) {
  return cached("wealth", async () => {
    const clientsDataset = await buildClientsDataset(options);
    const index = clientIndex(clientsDataset);
    const requests = [...ASSET_SOURCES, ...LIABILITY_SOURCES].map(([table, _label, value]) =>
      dataRestFetchAll(table, `user_id,${value},created_at`, { schema: "core" }));
    const sourceRows = await Promise.all(requests);
    const byUser = new Map();
    const totalsByClass = [];
    const ensure = (userId) => {
      const key = String(userId);
      if (!byUser.has(key)) byUser.set(key, { assets: 0, liabilities: 0, hasAssets: false, hasLiabilities: false, classes: {} });
      return byUser.get(key);
    };
    [...ASSET_SOURCES, ...LIABILITY_SOURCES].forEach(([table, label, valueKey], sourceIndex) => {
      const liability = sourceIndex >= ASSET_SOURCES.length;
      let total = 0;
      for (const row of officialRows(sourceRows[sourceIndex], index)) {
        const value = Number(row[valueKey]) || 0;
        const target = ensure(row.user_id);
        target[liability ? "hasLiabilities" : "hasAssets"] = true;
        target[liability ? "liabilities" : "assets"] += value;
        target.classes[label] = (target.classes[label] || 0) + value;
        total += value;
      }
      totalsByClass.push({ table, label, total, liability });
    });
    const rows = clientsDataset.clients.map((client) => {
      const wealth = byUser.get(String(client.id));
      return { ...client, wealth: wealth ? { ...wealth, net: wealth.assets - wealth.liabilities } : null };
    });
    return { clients: clientsDataset.clients, advisors: clientsDataset.advisors, rows, totalsByClass, source: { schemas: ["auth", "core"], tables: ["auth.users", ...ASSET_SOURCES.map(([table]) => `core.${table}`), ...LIABILITY_SOURCES.map(([table]) => `core.${table}`)] }, completenessRule: "Completude de dados financeiros = presença nos domínios Ativos/Investimentos, Dívidas e Open Finance. É cobertura analítica proposta, não regra oficial de negócio." };
  }, options);
}

export function buildOpenFinanceDataset(options = {}) {
  return cached("open-finance", async () => {
    const clientsDataset = await buildClientsDataset(options);
    const index = clientIndex(clientsDataset);
    const [connections, accounts] = await Promise.all([
      dataRestFetchAll("connections", "id,user_id,connection_name,connector_type,is_open_finance,item_status,execution_status,sync_status,last_synced_at,created_at,last_error_code", { schema: "core" }),
      dataRestFetchAll("accounts", "id,user_id,item_id,name,type,subtype,balance,created_at", { schema: "core" }),
    ]);
    const accountsByUser = new Map();
    for (const account of officialRows(accounts, index)) {
      const key = String(account.user_id);
      if (!accountsByUser.has(key)) accountsByUser.set(key, []);
      accountsByUser.get(key).push(account);
    }
    const rows = officialRows(connections, index).map((row) => {
      const client = index.get(String(row.user_id));
      const userAccounts = accountsByUser.get(String(row.user_id)) || [];
      return { id: row.id, clientId: row.user_id, clientName: client?.name || client?.email || "Cliente sem nome", advisorId: client?.advisorId || null, advisor: client?.advisor || null, institution: row.connection_name || row.connector_type || "Não informado", status: row.item_status, result: row.execution_status, syncStatus: row.sync_status, lastSyncAt: row.last_synced_at, createdAt: row.created_at, isOpenFinance: row.is_open_finance, errorCode: row.last_error_code, accounts: userAccounts.length, accountTypes: [...new Set(userAccounts.map((account) => account.type || account.subtype).filter(Boolean))] };
    });
    return { clients: clientsDataset.clients, advisors: clientsDataset.advisors, rows, accounts: officialRows(accounts, index), source: { schemas: ["auth", "core"], tables: ["auth.users", "core.connections", "core.accounts"] } };
  }, options);
}

export function buildFormsDataset(options = {}) {
  return cached("forms", async () => {
    const clientsDataset = await buildClientsDataset(options);
    const index = clientIndex(clientsDataset);
    const [submissions, forms] = await Promise.all([
      dataRestFetchAll("form_submissions", "id,user_id,form_id,created_at,submitted_at", { schema: "core" }),
      dataRestFetchAll("forms", "id,key,title,description", { schema: "core" }),
    ]);
    const formIndex = new Map(forms.map((row) => [String(row.id), row]));
    const rows = officialRows(submissions, index).map((row) => {
      const client = index.get(String(row.user_id));
      const form = formIndex.get(String(row.form_id));
      return { id: row.id, clientId: row.user_id, clientName: client?.name || client?.email || "Cliente sem nome", advisorId: client?.advisorId || null, advisor: client?.advisor || null, formId: row.form_id, formName: form?.title || form?.key || "Não informado", status: row.submitted_at ? "Concluído" : "Iniciado", startedAt: row.created_at, completedAt: row.submitted_at };
    });
    return { clients: clientsDataset.clients, advisors: clientsDataset.advisors, rows, forms, source: { schemas: ["auth", "core"], tables: ["auth.users", "core.form_submissions", "core.forms"] } };
  }, options);
}

export function buildPaymentsDataset(options = {}) {
  return cached("payments", async () => {
    const clientsDataset = await buildClientsDataset(options);
    const index = clientIndex(clientsDataset);
    const payments = await dataRestFetchAll("user_payments", "id,user_id,paid_at,cycle_start,cycle_end", { schema: "core" });
    const rows = officialRows(payments, index).map((row) => {
      const client = index.get(String(row.user_id));
      return { id: row.id, clientId: row.user_id, clientName: client?.name || client?.email || "Cliente sem nome", advisorId: client?.advisorId || null, advisor: client?.advisor || null, date: row.paid_at, cycleStart: row.cycle_start, cycleEnd: row.cycle_end, status: row.paid_at ? "Registrado" : "Sem data" };
    });
    return { clients: clientsDataset.clients, advisors: clientsDataset.advisors, rows, amountAvailable: false, source: { schemas: ["auth", "core"], tables: ["auth.users", "core.user_payments"] } };
  }, options);
}

export function buildUsageContextDataset(options = {}) {
  return cached("usage-context", async () => {
    const dataset = await buildClientsDataset(options);
    const count = (predicate) => dataset.clients.filter(predicate).length;
    return { available: true, officialClients: dataset.populationTotal, kpis: [
      { key: "official", label: "Clientes oficiais", value: dataset.populationTotal },
      { key: "onboarding", label: "Onboarding concluído", value: count((client) => client.onboardingComplete) },
      { key: "mechanisms", label: "Com mecanismos", value: count((client) => client.hasMechanisms) },
      { key: "openFinance", label: "Com Open Finance", value: count((client) => client.hasOpenFinance) },
      { key: "wealth", label: "Com patrimônio", value: count((client) => client.hasWealth) },
      { key: "journey", label: "Com jornada iniciada", value: count((client) => client.hasJourney) },
    ], individualExpoLinkConfirmed: false, note: "Métricas agregadas da base Pharus; não representam usuários Expo." };
  }, options);
}

export const DOMAIN_BUILDERS = {
  journey: buildJourneyDataset,
  meetings: buildMeetingsDataset,
  wealth: buildWealthDataset,
  "open-finance": buildOpenFinanceDataset,
  forms: buildFormsDataset,
  payments: buildPaymentsDataset,
  "usage-context": buildUsageContextDataset,
};
