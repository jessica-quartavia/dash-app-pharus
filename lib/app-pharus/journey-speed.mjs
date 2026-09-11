/**
 * Velocidade da jornada na página Jornada.
 * População: mesma regra oficial (isOfficialPharusClient).
 * Entrada: auth.users.created_at — o mesmo registeredAt da página Clientes.
 * Marcos: primeira core.scheduled_meetings com status = completed por tipo.
 */
import { timestampToIsoDate } from "../../js/lib/filters/period.mjs";
import { filterClients, resolvePeriodRange } from "../../js/lib/filters/apply.mjs";
import { formatPercent, median, percentOf } from "../../js/utils/format.mjs";

export const JOURNEY_SPEED_ENTRY_RULE =
  "Data de entrada = auth.users.created_at, convertida com timestampToIsoDate (America/Sao_Paulo), o mesmo registeredAt da página Clientes.";

export const JOURNEY_SPEED_PERIOD_RULE =
  "O filtro de período recorta a população oficial pela data de cadastro (registeredAt / created_at). Depois calcula o primeiro marco completed daquele cliente. Não filtra a data da reunião.";

export const COMPLETED_MEETING_STATUS = "completed";

export const JOURNEY_SPEED_STAGES = [
  {
    key: "rota_patrimonial",
    label: "Rota Patrimonial",
    kpiLabel: "Mediana até Rota Patrimonial",
    description: "Tempo típico desde o cadastro até a primeira Rota Patrimonial.",
    tooltip:
      "Metade dos clientes que realizou a Rota Patrimonial chegou a essa etapa em até este número de dias.",
    catalogTitles: ["Rota Patrimonial"],
    catalogSlugs: ["wealth-route"],
  },
  {
    key: "ativacao_engrenagens",
    label: "Ativação das Engrenagens",
    kpiLabel: "Mediana até Ativação das Engrenagens",
    description: "Tempo típico desde o cadastro até a primeira Ativação das Engrenagens.",
    tooltip:
      "Metade dos clientes que realizou a Ativação das Engrenagens chegou a essa etapa em até este número de dias.",
    catalogTitles: ["Ativação das Engrenagens"],
    catalogSlugs: ["gears-activation"],
  },
  {
    key: "central_inteligencia",
    label: "Central de Inteligência",
    kpiLabel: "Mediana até Central de Inteligência",
    description: "Tempo típico desde o cadastro até a primeira Central de Inteligência.",
    tooltip:
      "Metade dos clientes que realizou a Central de Inteligência chegou a essa etapa em até este número de dias.",
    catalogTitles: ["Liberação da Central de Inteligência", "Central de Inteligência"],
    catalogSlugs: ["intelligence-center-release"],
  },
];

export function foldMeetingLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveMeetingStage(catalogRow, stages = JOURNEY_SPEED_STAGES) {
  if (!catalogRow || typeof catalogRow !== "object") return null;
  const title = foldMeetingLabel(catalogRow.meeting_title || catalogRow.title);
  const slug = foldMeetingLabel(catalogRow.meeting_slug || catalogRow.slug);
  if (!title && !slug) return null;
  for (const stage of stages) {
    const titles = (stage.catalogTitles || []).map(foldMeetingLabel);
    const slugs = (stage.catalogSlugs || []).map(foldMeetingLabel);
    const titleHit = titles.some((item) => item && (title === item || title.includes(item)));
    const slugHit = slugs.some((item) => item && slug === item);
    if (titleHit || slugHit) return stage;
  }
  return null;
}

export function isCompletedMeeting(row) {
  return String(row?.status || "").trim().toLowerCase() === COMPLETED_MEETING_STATUS;
}

export function meetingOccurredAt(row) {
  return row?.start_time || row?.end_time || null;
}

export function durationDays(entryAt, occurredAt) {
  if (!entryAt || !occurredAt) return { days: null, invalid: "missing" };
  const start = new Date(entryAt).getTime();
  const end = new Date(occurredAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { days: null, invalid: "missing" };
  if (end < start) return { days: null, invalid: "chronology" };
  return { days: (end - start) / 86400000, invalid: null };
}

export function roundFriendlyDays(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round(Number(value));
}

export function hasPlatformAccess(lastSignInAt) {
  return Boolean(String(lastSignInAt || "").trim());
}

function catalogIndex(catalog = []) {
  return new Map((catalog || []).map((row) => [String(row.id), row]));
}

export function indexCatalogByStage(catalog = [], stages = JOURNEY_SPEED_STAGES) {
  const matches = {};
  for (const stage of stages) matches[stage.key] = [];
  for (const row of catalog || []) {
    const stage = resolveMeetingStage(row, stages);
    if (!stage) continue;
    matches[stage.key].push({
      id: row.id,
      meeting_title: row.meeting_title || null,
      meeting_slug: row.meeting_slug || null,
    });
  }
  return matches;
}

export function firstCompletedMeetingsByStage({
  meetings = [],
  catalog = [],
  officialIds,
  stages = JOURNEY_SPEED_STAGES,
} = {}) {
  const allowed = officialIds instanceof Set ? officialIds : new Set(officialIds || []);
  const byId = catalogIndex(catalog);
  const first = new Map();
  for (const row of meetings || []) {
    if (!isCompletedMeeting(row)) continue;
    const userId = row.user_id != null ? String(row.user_id) : "";
    if (!userId || (allowed.size && !allowed.has(userId))) continue;
    const catalogRow = byId.get(String(row.meeting_id));
    const stage = resolveMeetingStage(catalogRow, stages);
    if (!stage) continue;
    const occurredAt = meetingOccurredAt(row);
    if (!occurredAt) continue;
    const key = `${userId}::${stage.key}`;
    const current = first.get(key);
    if (
      !current ||
      String(occurredAt) < String(current.occurredAt) ||
      (String(occurredAt) === String(current.occurredAt) && String(row.id || "") < String(current.id || ""))
    ) {
      first.set(key, {
        userId,
        stageKey: stage.key,
        occurredAt,
        meetingId: row.meeting_id || null,
        id: row.id || null,
        title: catalogRow?.meeting_title || null,
        slug: catalogRow?.meeting_slug || null,
      });
    }
  }
  return [...first.values()];
}

function reachedNote(count) {
  if (count == null) return "Cobertura da etapa indisponível.";
  const n = Number(count) || 0;
  if (n === 1) return "1 cliente chegou à etapa";
  return `${n} clientes chegaram à etapa`;
}

export function hasJourneySpeedSource(source) {
  return Boolean(source && Array.isArray(source.clients));
}

export function unavailableJourneySpeed(stages = JOURNEY_SPEED_STAGES) {
  const stageResults = stages.map((stage) => ({
    key: stage.key,
    label: stage.label,
    kpiLabel: stage.kpiLabel,
    description: stage.description,
    tooltip: stage.tooltip,
    reachedCount: null,
    validDurationCount: null,
    invalidChronologyCount: null,
    medianDays: null,
    displayDays: null,
    catalog: [],
  }));
  return {
    status: "unavailable",
    periodApplied: false,
    periodRule: JOURNEY_SPEED_PERIOD_RULE,
    entryDateRule: JOURNEY_SPEED_ENTRY_RULE,
    population: null,
    stages: stageResults,
    access: {
      accessed: null,
      neverAccessed: null,
      accessedPercent: null,
      neverPercent: null,
      insight: "",
      segments: [],
    },
    invalidChronologyCount: null,
    kpis: [
      ...stageResults.map((stage) => ({
        key: `median_${stage.key}`,
        label: stage.kpiLabel,
        status: "unavailable",
        kind: "days",
        value: "Não disponível",
        note: "A fonte da velocidade da jornada não chegou nesta página.",
        tooltip: stage.tooltip,
        description: stage.description,
        featured: true,
      })),
      {
        key: "never_accessed",
        label: "Nunca acessaram",
        status: "unavailable",
        value: "Não disponível",
        note: "A fonte da velocidade da jornada não chegou nesta página.",
        tooltip: "Clientes cadastrados que ainda não possuem nenhum login registrado no sistema.",
        description: "Clientes cadastrados sem nenhum login registrado.",
        insight: "",
        featured: false,
      },
    ],
    chart: [],
  };
}

export function summarizeJourneySpeed(source, scheduledMeetings = [], filters = {}) {
  const presented = hasJourneySpeedSource(source)
    ? presentJourneySpeed(source, filters)
    : unavailableJourneySpeed();
  const rota = presented.stages.find((stage) => stage.key === "rota_patrimonial");
  const activation = presented.stages.find((stage) => stage.key === "ativacao_engrenagens");
  const central = presented.stages.find((stage) => stage.key === "central_inteligencia");
  return {
    officialClients: Array.isArray(source?.clients) ? source.clients.length : null,
    completedMeetings: (scheduledMeetings || []).filter(isCompletedMeeting).length,
    firstCompleted: Array.isArray(source?.firstCompleted) ? source.firstCompleted.length : null,
    routeClients: rota?.reachedCount ?? null,
    activationClients: activation?.reachedCount ?? null,
    intelligenceClients: central?.reachedCount ?? null,
    routeMedian: rota?.displayDays ?? null,
    activationMedian: activation?.displayDays ?? null,
    intelligenceMedian: central?.displayDays ?? null,
    accessed: presented.access?.accessed ?? null,
    neverAccessed: presented.access?.neverAccessed ?? null,
    status: presented.status || "ok",
  };
}

export function logJourneySpeedDebug(source, scheduledMeetings = [], filters = {}) {
  if (process.env.NODE_TEST_CONTEXT) return;
  const summary = summarizeJourneySpeed(source, scheduledMeetings, filters);
  console.info("[journey-speed-debug]", summary);
}

export function buildJourneySpeedSource({
  users = [],
  meetings = [],
  catalog = [],
  stages = JOURNEY_SPEED_STAGES,
} = {}) {
  const clients = (users || []).map((user) => ({
    id: String(user.id),
    registeredAt: user.registeredAt || timestampToIsoDate(user.created_at || user.createdAt),
    createdAt: user.createdAt || user.created_at || null,
    lastSignInAt: user.lastSignInAt || user.last_sign_in_at || null,
    name: user.name || "",
    email: user.email || "",
    advisorId: user.advisorId || null,
    advisor: user.advisor || null,
  }));
  const officialIds = new Set(clients.map((client) => client.id));
  return {
    clients,
    firstCompleted: firstCompletedMeetingsByStage({
      meetings,
      catalog,
      officialIds,
      stages,
    }),
    catalogMatches: indexCatalogByStage(catalog, stages),
    entryDateRule: JOURNEY_SPEED_ENTRY_RULE,
    periodRule: JOURNEY_SPEED_PERIOD_RULE,
    meetingTypeField: "core.meetings.meeting_title / meeting_slug via scheduled_meetings.meeting_id",
    meetingTimeField: "core.scheduled_meetings.start_time (fallback end_time)",
  };
}

export function presentJourneySpeed(source = {}, filters = {}, stages = JOURNEY_SPEED_STAGES) {
  if (!hasJourneySpeedSource(source)) {
    if (!process.env.NODE_TEST_CONTEXT) {
      console.info("[journey-speed-debug]", { status: "unavailable", reason: "missing_source" });
    }
    return unavailableJourneySpeed(stages);
  }
  const clients = filterClients(source.clients || [], filters, { dateField: "registeredAt" });
  const ids = new Set(clients.map((client) => String(client.id)));
  const clientMap = new Map(clients.map((client) => [String(client.id), client]));
  const range = resolvePeriodRange(filters);
  const milestones = (source.firstCompleted || []).filter((row) => ids.has(String(row.userId)));

  let invalidChronologyCount = 0;
  const stageResults = stages.map((stage) => {
    const rows = milestones.filter((row) => row.stageKey === stage.key);
    const durations = [];
    let invalid = 0;
    for (const row of rows) {
      const client = clientMap.get(String(row.userId));
      const entryAt = client?.createdAt || client?.registeredAt;
      const result = durationDays(entryAt, row.occurredAt);
      if (result.invalid === "chronology") {
        invalid += 1;
        invalidChronologyCount += 1;
        continue;
      }
      if (result.days == null) continue;
      durations.push(result.days);
    }
    const medianDays = median(durations);
    const displayDays = roundFriendlyDays(medianDays);
    return {
      key: stage.key,
      label: stage.label,
      kpiLabel: stage.kpiLabel,
      description: stage.description,
      tooltip: stage.tooltip,
      reachedCount: rows.length,
      validDurationCount: durations.length,
      invalidChronologyCount: invalid,
      medianDays,
      displayDays,
      catalog: source.catalogMatches?.[stage.key] || [],
    };
  });

  const neverAccessed = clients.filter((client) => !hasPlatformAccess(client.lastSignInAt)).length;
  const accessed = Math.max(0, clients.length - neverAccessed);
  const neverPercent = percentOf(neverAccessed, clients.length);
  const accessedPercent = percentOf(accessed, clients.length);

  const kpis = [
    ...stageResults.map((stage) => ({
      key: `median_${stage.key}`,
      label: stage.kpiLabel,
      status: "ok",
      kind: "days",
      value: stage.displayDays,
      note: reachedNote(stage.reachedCount),
      tooltip: stage.tooltip,
      description: stage.description,
      featured: true,
    })),
    {
      key: "never_accessed",
      label: "Nunca acessaram",
      status: "ok",
      value: neverAccessed,
      note: `${formatPercent(neverPercent)} da base`,
      tooltip: "Clientes cadastrados que ainda não possuem nenhum login registrado no sistema.",
      description: "Clientes cadastrados sem nenhum login registrado.",
      insight:
        neverAccessed > 0
          ? "Estes clientes estão cadastrados, mas ainda não possuem login registrado."
          : "",
      featured: false,
    },
  ];

  return {
    status: "ok",
    periodApplied: Boolean(range.startDate || range.endDate),
    periodRule: source.periodRule || JOURNEY_SPEED_PERIOD_RULE,
    entryDateRule: source.entryDateRule || JOURNEY_SPEED_ENTRY_RULE,
    population: clients.length,
    stages: stageResults,
    access: {
      accessed,
      neverAccessed,
      accessedPercent,
      neverPercent,
      insight:
        neverAccessed > 0
          ? "Estes clientes estão cadastrados, mas ainda não possuem login registrado."
          : "",
      segments: [
        {
          key: "accessed",
          label: "Já acessaram",
          count: accessed,
          percent: accessedPercent,
        },
        {
          key: "never",
          label: "Nunca acessaram",
          count: neverAccessed,
          percent: neverPercent,
        },
      ],
    },
    invalidChronologyCount,
    kpis,
    chart: stageResults.map((stage) => ({
      label: stage.label,
      count: stage.displayDays,
      displayDays: stage.displayDays,
      reachedCount: stage.reachedCount,
      medianDays: stage.medianDays,
    })),
  };
}
