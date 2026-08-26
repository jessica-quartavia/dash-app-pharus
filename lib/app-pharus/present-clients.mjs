/**
 * Montagem e apresentação da lista de clientes (browser + servidor).
 * Não importa Auth Admin nem PostgREST.
 */
import { timestampToIsoDate } from "../../js/lib/filters/period.mjs";
import { filterClients, inPeriod, resolvePeriodRange } from "../../js/lib/filters/apply.mjs";
import { displayClientName, indexByUserId } from "./clients.mjs";

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
  sources = {},
}) {
  const official = users || [];
  const profileMap = indexByUserId(profiles);
  const stageMap = indexByUserId(stages);
  const records = official.map((user) => {
    const id = String(user.id);
    const profile = profileMap.get(id);
    const stageOk = sources.user_progress !== false && sources.v_current_stage !== false;
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
      status: null,
      lastActivityAt: null,
      advisor: null,
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
      ? "Base oficial do App Pharus, sem filtros."
      : `Total oficial: ${officialTotal}. No recorte: ${recorte.length}.`;

  const kpis = [
    okKpi("total", "Total de clientes", officialTotal, recorteNote),
    pendingKpi(
      "active",
      "Clientes ativos",
      "Ainda não há definição de cliente ativo no App.",
    ),
  ];

  if (periodApplied) {
    kpis.push(
      okKpi(
        "new",
        "Novos no período",
        all.filter((client) => inPeriod(client.registeredAt, range)).length,
        "Clientes da base oficial cadastrados no período selecionado.",
      ),
    );
  }

  kpis.push(
    pendingKpi(
      "complete",
      "Cadastro completo",
      "Ainda não há definição de cadastro completo. Concluir o onboarding não equivale a cadastro completo.",
    ),
    pendingKpi(
      "inactive",
      "Sem atividade recente",
      "Ainda não há definição de atividade recente.",
    ),
  );

  return {
    kpis,
    rows: recorte,
    clientBase: payload.clientBase,
    methodology: payload.methodology,
    periodApplied,
    officialTotal,
    populationTotal: officialTotal,
    recorteTotal: recorte.length,
    filteredTotal: recorte.length,
    enrichment: payload.enrichment || {},
  };
}
