/**
 * Visão Geral — agregações reais do App Pharus.
 * Regras só entram quando comprovadas no banco (MCP / schema core).
 */
import { formatPercent } from "../../js/utils/format.mjs";
import { getDataRestConfig } from "../data/pharus-rest.mjs";
import { OFFICIAL_CLIENT_RULE, PHARUS_DATA_PROJECT, isOfficialClient } from "./clients.mjs";
import { kpiAudit, logKpiAudit } from "./debug.mjs";
import { officialImplementedPairs, officialImplementedUserIds } from "./mechanisms.mjs";
import {
  WEALTH_ASSET_TABLES,
  WEALTH_LIABILITY_TABLES,
  fetchCoreColumns,
  fetchCurrentStages,
  fetchOfficialClientRows,
} from "./queries.mjs";

function okKpi(key, label, value, note) {
  return { key, label, status: "ok", value, note };
}

function countBy(rows, field) {
  const counts = {};
  for (const row of rows || []) {
    const status = row?.[field] == null ? "(null)" : String(row[field]);
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

function distinctIds(rows, key, officialSet) {
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

function coverageOf(part, total) {
  if (!total) return null;
  return (Number(part) / Number(total)) * 100;
}

function coverageTone(percent) {
  if (percent >= 70) return "good";
  if (percent >= 40) return "warn";
  return "critical";
}

function coverageItem(label, kpi, total) {
  if (kpi.status !== "ok" || kpi.value == null || !total) {
    return {
      label,
      status: kpi.status,
      withData: null,
      withoutData: null,
      percent: null,
      tone: "unavailable",
      note: kpi.note,
    };
  }
  const withData = Number(kpi.value);
  const percent = coverageOf(withData, total);
  return {
    label,
    status: "ok",
    withData,
    withoutData: Math.max(0, total - withData),
    percent,
    tone: coverageTone(percent),
    note: kpi.note,
  };
}

export async function buildOverview() {
  const cfg = getDataRestConfig();
  if (!cfg.ok) {
    const err = new Error(cfg.error);
    err.code = cfg.code || "data_config";
    throw err;
  }
  if (cfg.authMode !== "service_role") {
    const err = new Error("/api/overview recusou anon key. Tabelas com RLS devolvem 0 linhas, não ausência de dados.");
    err.code = "anon_not_allowed";
    throw err;
  }

  const debug = [];
  const officialFetch = await fetchOfficialClientRows();
  const officialRows = officialFetch.rows.filter(isOfficialClient);
  const officialSet = new Set(officialRows.map((row) => String(row.id)));
  const total = officialSet.size;

  const clientBase = {
    found: total > 0,
    table: "auth.users",
    key: "id",
    total,
    view: officialFetch.source,
    reason: `${OFFICIAL_CLIENT_RULE.description} Fonte de leitura: Auth Admin listUsers (não PostgREST).`,
  };

  const [
    connections,
    formSubmissions,
    scheduledMeetings,
    meetingOutputs,
    userMechanisms,
    userProgress,
    currentStages,
    ...wealthTables
  ] = await Promise.all([
    fetchCoreColumns("connections", "user_id,is_open_finance,item_status,execution_status"),
    fetchCoreColumns("form_submissions", "user_id,submitted_at,form_id"),
    fetchCoreColumns("scheduled_meetings", "user_id,status"),
    fetchCoreColumns("meeting_outputs", "user_id"),
    fetchCoreColumns("user_mechanisms", "user_id,mechanism_id,status,created_at"),
    fetchCoreColumns("user_progress", "user_id,step,completed_at"),
    fetchCurrentStages(),
    ...WEALTH_ASSET_TABLES.map((table) => fetchCoreColumns(table, "user_id")),
    ...WEALTH_LIABILITY_TABLES.map((table) => fetchCoreColumns(table, "user_id")),
  ]);

  const assetRows = wealthTables.slice(0, WEALTH_ASSET_TABLES.length);
  const liabilityRows = wealthTables.slice(WEALTH_ASSET_TABLES.length);

  const registered = okKpi(
    "registered",
    "Clientes cadastrados",
    total,
    "Clientes da base oficial do App Pharus",
  );
  debug.push(
    kpiAudit({
      kpi: "Clientes cadastrados",
      schema: "auth",
      tables: `users (${officialFetch.source})`,
      key: "id",
      rows: officialFetch.fetched ?? officialFetch.rows.length,
      distinct: total,
      rule: OFFICIAL_CLIENT_RULE.sql,
      result: total,
      total,
      coverage: 100,
      status: "ok",
    }),
  );

  const onboardingUsers = distinctIds((userProgress || []).filter((row) => row.step === "complete" && row.completed_at), "user_id", officialSet);
  const centralUsers = distinctIds((userProgress || []).filter((row) => row.step === "intelligence_center"), "user_id", officialSet);
  const onboarding = okKpi("onboarding", "Onboarding concluído", onboardingUsers.size, "step = complete e completed_at preenchido");
  const journeyComplete = okKpi("journey_complete", "Jornada completa", centralUsers.size, "Clientes que chegaram à Central de Inteligência");

  const wealthUsers = new Set();
  let wealthRaw = 0;
  WEALTH_ASSET_TABLES.forEach((table, index) => {
    const rows = assetRows[index] || [];
    wealthRaw += rows.length;
    distinctIds(rows, "user_id", officialSet).forEach((id) => wealthUsers.add(id));
  });
  const wealth = okKpi(
    "wealth",
    "Com patrimônio cadastrado",
    wealthUsers.size,
    "Clientes com investimentos, imóveis ou outros ativos cadastrados.",
  );
  debug.push(
    kpiAudit({
      kpi: "Com patrimônio cadastrado",
      tables: WEALTH_ASSET_TABLES.join(", "),
      key: "user_id",
      rows: wealthRaw,
      distinct: wealthUsers.size,
      rule: "ATIVO = equities, fixed_income, investment_funds, private_pensions, other_investments, real_estate_assets, movable_assets, consortia. PASSIVO (excluído) = financings, loans. COUNT DISTINCT user_id ∩ clientes oficiais.",
      result: wealthUsers.size,
      total,
      coverage: coverageOf(wealthUsers.size, total),
      status: "ok",
    }),
  );

  const ofRows = (connections || []).filter((row) => row.is_open_finance === true && row.item_status === "UPDATED");
  const ofUsers = distinctIds(ofRows, "user_id", officialSet);
  const of = okKpi(
    "of",
    "Com Open Finance",
    ofUsers.size,
    "Clientes com conexão Open Finance válida",
  );
  debug.push(
    kpiAudit({
      kpi: "Com Open Finance",
      tables: "connections",
      key: "user_id",
      rows: connections.length,
      distinct: ofUsers.size,
      rule: "Conexão válida: is_open_finance IS TRUE AND item_status = 'UPDATED'. item_status observados: UPDATED, ERROR. execution_status: SUCCESS, PARTIAL_SUCCESS.",
      result: ofUsers.size,
      total,
      coverage: coverageOf(ofUsers.size, total),
      status: "ok",
    }),
  );

  const implementedRows = userMechanisms || [];
  const mechUsers = officialImplementedUserIds(implementedRows, officialSet);
  const mechPairs = officialImplementedPairs(implementedRows, officialSet);
  const mechCoverage = coverageOf(mechUsers.size, total);
  const mech = okKpi(
    "mech",
    "Com mecanismos",
    mechUsers.size,
    mechCoverage == null ? "Clientes com mecanismos implementados no App." : `${formatPercent(mechCoverage)} da base`,
  );
  debug.push(
    kpiAudit({
      kpi: "Com mecanismos",
      tables: "user_mechanisms",
      key: "user_id,mechanism_id",
      rows: implementedRows.length,
      distinct: mechUsers.size,
      rule: "Implementado = status suggested. COUNT DISTINCT user_id na população oficial. Ocorrências = DISTINCT user_id+mechanism_id.",
      result: mechUsers.size,
      occurrences: mechPairs.size,
      total,
      coverage: mechCoverage,
      status: "ok",
    }),
  );

  const submitted = (formSubmissions || []).filter((row) => row.submitted_at);
  const formUsers = distinctIds(submitted, "user_id", officialSet);
  const forms = okKpi(
    "forms",
    "Com formulário respondido",
    formUsers.size,
    "Clientes que responderam pelo menos um formulário.",
  );
  debug.push(
    kpiAudit({
      kpi: "Com formulário respondido",
      tables: "form_submissions",
      key: "user_id",
      rows: formSubmissions.length,
      distinct: formUsers.size,
      rule: "COUNT DISTINCT user_id WHERE submitted_at IS NOT NULL, restrito à população oficial. vw_form_questions_answers deriva de form_submissions ⋈ auth.users; o e-mail não é a chave.",
      result: formUsers.size,
      total,
      coverage: coverageOf(formUsers.size, total),
      status: "ok",
    }),
  );

  const completedMeetings = (scheduledMeetings || []).filter((row) => String(row.status) === "completed");
  const meetingUsers = distinctIds(completedMeetings, "user_id", officialSet);
  const meetings = okKpi(
    "meetings",
    "Com reuniões",
    meetingUsers.size,
    "Clientes com pelo menos uma reunião realizada.",
  );
  debug.push(
    kpiAudit({
      kpi: "Com reuniões",
      tables: "scheduled_meetings",
      key: "user_id",
      rows: scheduledMeetings.length,
      distinct: meetingUsers.size,
      rule: "Status reais: completed, scheduled, canceled (pending/rescheduled/no_show no enum, sem linhas). Conta reunião realizada: status = completed. meeting_outputs distinct oficiais = conferência.",
      result: meetingUsers.size,
      total,
      coverage: coverageOf(meetingUsers.size, total),
      status: "ok",
    }),
  );

  const journeyUsers = distinctIds(userProgress, "user_id", officialSet);
  const journey = okKpi(
    "journey",
    "Com jornada iniciada",
    journeyUsers.size,
    "Clientes que já iniciaram a jornada no App.",
  );
  debug.push(
    kpiAudit({
      kpi: "Com jornada iniciada",
      tables: "user_progress",
      key: "user_id",
      rows: userProgress.length,
      distinct: journeyUsers.size,
      rule: "Jornada iniciada = existência de linha em user_progress. Steps: personal_data, contract, financial_profile, alignment, meet_advisor, complete, patrimony_mapping, behavioral_diagnosis, intelligence_center. Não usar step=complete (isso é onboarding concluído).",
      result: journeyUsers.size,
      total,
      coverage: coverageOf(journeyUsers.size, total),
      status: "ok",
    }),
  );

  const kpis = [registered, onboarding, journeyComplete, of, mech, wealth, forms, meetings];
  const coverage = [wealth, of, mech, forms, meetings, journey].map((kpi) => coverageItem(kpi.label, kpi, total));

  const stageCounts = new Map();
  for (const row of currentStages || []) {
    if (!officialSet.has(String(row.user_id))) continue;
    const label = row.current_stage || "Não informado";
    stageCounts.set(label, (stageCounts.get(label) || 0) + 1);
  }
  const distribution = [...stageCounts].map(([label, count]) => ({ label, count, percent: coverageOf(count, total) }))
    .sort((a, b) => (a.label === "Não informado" ? 1 : b.label === "Não informado" ? -1 : b.count - a.count));
  const funnel = [
    ["Clientes cadastrados", total],
    ["Diagnóstico concluído", distinctIds((userProgress || []).filter((row) => row.step === "financial_profile" && row.completed_at), "user_id", officialSet).size],
    ["Onboarding concluído", onboardingUsers.size],
    ["Rota Patrimonial", distinctIds((userProgress || []).filter((row) => row.step === "patrimony_mapping" && row.completed_at), "user_id", officialSet).size],
    ["Ativação das Engrenagens", distinctIds((userProgress || []).filter((row) => row.step === "behavioral_diagnosis" && row.completed_at), "user_id", officialSet).size],
    ["Central de Inteligência", centralUsers.size],
  ].map(([label, count]) => ({ label, count, percent: coverageOf(count, total) }));
  const lastProgress = new Map();
  for (const row of userProgress || []) {
    if (!officialSet.has(String(row.user_id)) || !row.completed_at) continue;
    const key = String(row.user_id);
    if (!lastProgress.has(key) || row.completed_at > lastProgress.get(key)) lastProgress.set(key, row.completed_at);
  }
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffIso = cutoff.toISOString();
  const inactiveOver30 = [...officialSet].filter((id) => !centralUsers.has(id) && (!lastProgress.get(id) || lastProgress.get(id) < cutoffIso)).length;
  const alerts = [
    { label: "Clientes parados há mais de 30 dias", value: inactiveOver30, tone: inactiveOver30 ? "warn" : "good" },
    { label: "Sem Open Finance", value: total - ofUsers.size, tone: "warn" },
    { label: "Sem mecanismos", value: total - mechUsers.size, tone: "warn" },
  ];

  for (const entry of debug) logKpiAudit(entry);

  return {
    source: {
      projectId: cfg.projectId || PHARUS_DATA_PROJECT,
      schema: "core",
      authMode: cfg.authMode,
      officialSource: officialFetch.source,
    },
    clientBase,
    denominator: total,
    kpis,
    coverage,
    monthly: {
      status: "pending",
      title: "Clientes utilizando o App por mês",
      message:
        "Ainda não há um recorte mensal único de utilização do App.",
      series: [],
    },
    journey: { funnel, distribution },
    alerts,
    insights: [],
    periodApplied: false,
    methodology:
      "Indicadores da base oficial do App Pharus. Cobertura = clientes com o recurso sobre o total da base. Não é um funil sequencial. Open Finance conta só conexão válida. Patrimônio ignora passivos. Mecanismos = clientes com pelo menos um mecanismo implementado.",
    debug,
    liabilityNote: {
      tables: WEALTH_LIABILITY_TABLES,
      distinctOfficial: distinctIds(liabilityRows.flat(), "user_id", officialSet).size,
    },
    meetingOutputsOfficial: distinctIds(meetingOutputs, "user_id", officialSet).size,
    connectionStatusCounts: {
      item_status: countBy(connections, "item_status"),
      is_open_finance: countBy(connections, "is_open_finance"),
    },
  };
}
