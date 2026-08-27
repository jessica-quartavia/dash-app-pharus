/**
 * Montagem e apresentação da lista de clientes (browser + servidor).
 */
import { timestampToIsoDate } from "../../js/lib/filters/period.mjs";
import { filterClients, resolvePeriodRange } from "../../js/lib/filters/apply.mjs";
import { displayClientName, indexByUserId } from "./clients.mjs";
import {
  OPERATIONAL_ACTIVITY_SOURCES,
  countOperationalInactive,
  operationalInactivityCutoffIso,
} from "./operational-activity.mjs";
import { classifyClientTier, tierDistribution } from "./segmentation.mjs";

function pendingKpi(key, label, reason) {
  return { key, label, status: "pending", kind: "text", value: "Regra pendente", note: reason };
}

function okKpi(key, label, value, note) {
  return { key, label, status: "ok", value, note };
}

function flagOrUnavailable(sourceOk, hasValue) {
  if (!sourceOk) return null;
  return hasValue;
}

export function assembleOfficialClients({
  users,
  profiles = [],
  stages = [],
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
  advisorMap = new Map(),
  engineMap = new Map(),
  sources = {},
}) {
  const official = users || [];
  const profileMap = indexByUserId(profiles);
  const stageMap = indexByUserId(stages);
  const records = official.map((user) => {
    const id = String(user.id);
    const profile = profileMap.get(id);
    const stageOk = sources.user_progress !== false && sources.v_current_stage !== false;
    const engine = engineMap.get(id);
    const enginesOk = sources.user_engines !== false;
    const segmentation = enginesOk
      ? classifyClientTier({
          income: engine?.income,
          reserve: engine?.reserve,
          contribution: engine?.contribution,
        })
      : {
          tier: "Dados insuficientes",
          tierReasons: ["Fonte user_engines indisponível"],
          income: null,
          reserve: null,
          contribution: null,
        };
    const advisorInfo = advisorMap.get(id);
    return {
      id,
      name: displayClientName(user, profile),
      email: String(user.email || "").trim(),
      registeredAt: timestampToIsoDate(user.created_at),
      createdAt: user.created_at || null,
      hasWealth: flagOrUnavailable(sources.wealth !== false, wealthIds.has(id)),
      hasOpenFinance: flagOrUnavailable(sources.connections !== false, ofIds.has(id)),
      hasMechanisms: flagOrUnavailable(sources.user_mechanisms !== false, mechanismIds.has(id)),
      mechanismsImplemented:
        sources.user_mechanisms === false ? null : mechanismCounts?.get(id) || 0,
      hasMeetings: flagOrUnavailable(sources.scheduled_meetings !== false, meetingIds.has(id)),
      hasForms: flagOrUnavailable(sources.form_submissions !== false, formIds.has(id)),
      hasJourney: flagOrUnavailable(sources.user_progress !== false, journeyIds.has(id)),
      journeyStage: stageOk ? stageMap.get(id)?.current_stage || "Não informado" : "Dados indisponíveis",
      onboardingComplete:
        sources.user_progress === false ? null : Boolean(onboardingIds?.has(id)),
      personalDataComplete:
        sources.user_progress === false ? null : Boolean(personalDataIds?.has(id)),
      lastOperationalActivityAt:
        sources.user_progress === false &&
        sources.form_submissions === false &&
        sources.scheduled_meetings === false &&
        sources.user_mechanisms === false
          ? null
          : lastOperationalActivity?.get(id) || null,
      tier: segmentation.tier,
      tierReasons: segmentation.tierReasons,
      tierIncome: segmentation.income,
      tierReserve: segmentation.reserve,
      tierContribution: segmentation.contribution,
      isDebts: null,
      status: null,
      lastActivityAt: null,
      advisorId: advisorInfo?.advisorId || null,
      advisor: advisorInfo?.advisor || null,
      wealthTotal: null,
    };
  });
  records.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return records;
}

export function presentClientsPage(payload, filters = {}) {
  const all = payload.clients || [];
  const range = resolvePeriodRange(filters);
  const periodApplied = Boolean(range.startDate || range.endDate);
  const recorte = filterClients(all, filters, { dateField: "registeredAt" });
  const officialTotal = payload.populationTotal ?? payload.clientBase?.total ?? all.length;
  const recorteNote =
    recorte.length === officialTotal
      ? "Base oficial do App Pharus, sem filtros de recorte."
      : `População oficial: ${officialTotal}. No recorte: ${recorte.length}.`;

  const kpis = [
    okKpi("total", "Total de clientes", recorte.length, recorteNote),
    pendingKpi(
      "active",
      "Situação de uso no App",
      "Ainda não há definição comprovada de cliente ativo no App.",
    ),
  ];

  if (periodApplied) {
    kpis.push(
      okKpi(
        "new",
        "Novos no período",
        recorte.length,
        "Clientes do recorte cadastrados no período selecionado.",
      ),
    );
  }

  const enrichment = payload.enrichment || {};
  const progressOk = enrichment.user_progress === "ok";
  const activitySourcesOk =
    enrichment.user_progress === "ok" ||
    enrichment.form_submissions === "ok" ||
    enrichment.scheduled_meetings === "ok" ||
    enrichment.user_mechanisms === "ok";

  if (progressOk) {
    kpis.push(
      okKpi(
        "onboarding",
        "Onboarding concluído",
        recorte.filter((client) => client.onboardingComplete).length,
        "Clientes do recorte que concluíram o onboarding no App.",
      ),
      okKpi(
        "personal_data",
        "Dados pessoais concluídos",
        recorte.filter((client) => client.personalDataComplete).length,
        "Etapa personal_data concluída no recorte.",
      ),
    );
  } else {
    kpis.push(
      pendingKpi("onboarding", "Onboarding concluído", "Fonte user_progress indisponível."),
      pendingKpi("personal_data", "Dados pessoais concluídos", "Fonte user_progress indisponível."),
    );
  }

  if (activitySourcesOk) {
    const cutoffIso = operationalInactivityCutoffIso(30);
    kpis.push(
      okKpi(
        "inactive",
        "Sem atividade operacional recente",
        countOperationalInactive(recorte, cutoffIso),
        `Última atividade operacional há mais de 30 dias ou nenhuma registrada. Fontes: ${OPERATIONAL_ACTIVITY_SOURCES}`,
      ),
    );
  } else {
    kpis.push(
      pendingKpi(
        "inactive",
        "Sem atividade operacional recente",
        "Fontes transacionais indisponíveis para calcular atividade operacional.",
      ),
    );
  }

  const segmentChart = tierDistribution(recorte);

  return {
    kpis,
    rows: recorte,
    segmentChart,
    advisors: payload.advisors || [],
    clientBase: payload.clientBase,
    methodology: payload.methodology,
    periodApplied,
    officialTotal,
    populationTotal: officialTotal,
    recorteTotal: recorte.length,
    filteredTotal: recorte.length,
    enrichment: payload.enrichment || {},
    debtsRulePending: true,
  };
}
