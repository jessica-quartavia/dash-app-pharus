/** Auditoria agregada e somente leitura dos domínios analíticos. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { dataRestFetchAll } from "../lib/data/pharus-rest.mjs";
import { fetchOfficialUsers, WEALTH_ASSET_TABLES, WEALTH_LIABILITY_TABLES } from "../lib/app-pharus/queries.mjs";
import { isOfficialClient } from "../lib/app-pharus/clients.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(root);

const officialFetch = await fetchOfficialUsers();
const official = officialFetch.rows.filter(isOfficialClient);
const officialSet = new Set(official.map((row) => String(row.id)));
const allowed = (row) => row?.user_id && officialSet.has(String(row.user_id));
const distinct = (rows) => new Set((rows || []).filter(allowed).map((row) => String(row.user_id)));
const pct = (part) => officialSet.size ? Math.round((part / officialSet.size) * 1000) / 10 : null;
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const days = (from, to) => {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.floor((b - a) / 86400000);
};

const [progress, stages, mechanisms, meetings, meetingCatalog, evaluations, quality, connections, accounts, forms, payments, ...wealth] = await Promise.all([
  dataRestFetchAll("user_progress", "user_id,step,created_at,completed_at", { schema: "core" }),
  dataRestFetchAll("v_current_stage", "user_id,current_stage,created_at", { schema: "metrics" }),
  dataRestFetchAll("user_mechanisms", "user_id,mechanism_id,status,created_at", { schema: "core" }),
  dataRestFetchAll("scheduled_meetings", "id,user_id,meeting_id,advisor_internal_id,start_time,end_time,status", { schema: "core" }),
  dataRestFetchAll("meetings", "id,meeting_title,meeting_slug,order,is_active", { schema: "core" }),
  dataRestFetchAll("scheduled_meeting_evaluation", "scheduled_meeting_id,user_id,stars,selected_quality_slugs,other_text,created_at", { schema: "core" }),
  dataRestFetchAll("meeting_quality_dimension", "slug,label,polarity,status", { schema: "core" }),
  dataRestFetchAll("connections", "user_id,is_open_finance,item_status,execution_status,last_synced_at,created_at", { schema: "core" }),
  dataRestFetchAll("accounts", "user_id,type,subtype,balance,created_at", { schema: "core" }),
  dataRestFetchAll("form_submissions", "user_id,form_id,submitted_at,created_at", { schema: "core" }),
  dataRestFetchAll("user_payments", "user_id,paid_at,cycle_start,cycle_end", { schema: "core" }),
  ...WEALTH_ASSET_TABLES.map((table) => dataRestFetchAll(table, "user_id,created_at", { schema: "core" })),
  ...WEALTH_LIABILITY_TABLES.map((table) => dataRestFetchAll(table, "user_id,created_at", { schema: "core" })),
]);

const progressOfficial = progress.filter(allowed);
const journeySteps = [
  "personal_data", "contract", "financial_profile", "alignment", "meet_advisor", "complete",
  "patrimony_mapping", "behavioral_diagnosis", "intelligence_center",
];
const stepStats = journeySteps.map((step) => {
  const rows = progressOfficial.filter((row) => row.step === step);
  const completed = distinct(rows.filter((row) => row.completed_at));
  return { step, rows: rows.length, completed: completed.size, coverage: pct(completed.size) };
});

const progressByUser = new Map();
for (const row of progressOfficial) {
  const key = String(row.user_id);
  if (!progressByUser.has(key)) progressByUser.set(key, []);
  progressByUser.get(key).push(row);
}

const transitionStats = journeySteps.slice(0, -1).map((step, index) => {
  const next = journeySteps[index + 1];
  const intervals = [];
  for (const rows of progressByUser.values()) {
    const from = rows.find((row) => row.step === step && row.completed_at)?.completed_at;
    const to = rows.find((row) => row.step === next && row.completed_at)?.completed_at;
    const gap = days(from, to);
    if (gap != null) intervals.push(gap);
  }
  return { from: step, to: next, validPairs: intervals.length, medianDays: median(intervals), negativeIntervalsDiscarded: 0 };
});

const completedJourneyIds = distinct(progressOfficial.filter((row) => row.step === "intelligence_center" && row.completed_at));
const onboardingIds = distinct(progressOfficial.filter((row) => row.step === "complete" && row.completed_at));
const totalDurations = [];
for (const rows of progressByUser.values()) {
  const start = rows.map((row) => row.created_at).filter(Boolean).sort()[0];
  const end = rows.find((row) => row.step === "intelligence_center" && row.completed_at)?.completed_at;
  const duration = days(start, end);
  if (duration != null) totalDurations.push(duration);
}

const stageCounts = new Map();
for (const row of stages.filter(allowed)) {
  const label = row.current_stage || "Não informado";
  stageCounts.set(label, (stageCounts.get(label) || 0) + 1);
}
const currentDistribution = [...stageCounts.entries()]
  .map(([stage, clients]) => ({ stage, clients, coverage: pct(clients) }))
  .sort((a, b) => (a.stage === "Não informado" ? 1 : b.stage === "Não informado" ? -1 : b.clients - a.clients));

const today = new Date();
const inactivityDays = [];
for (const [userId, rows] of progressByUser.entries()) {
  if (completedJourneyIds.has(userId)) continue;
  const last = rows.map((row) => row.completed_at).filter(Boolean).sort().at(-1);
  inactivityDays.push(last ? days(last, today.toISOString()) : Infinity);
}

const meetingById = new Map(meetingCatalog.map((row) => [String(row.id), row]));
const scheduledById = new Map(meetings.map((row) => [String(row.id), row]));
const qualityBySlug = new Map(quality.map((row) => [String(row.slug), row]));
const evaluationGroups = new Map();
for (const evaluation of evaluations.filter(allowed)) {
  const scheduled = scheduledById.get(String(evaluation.scheduled_meeting_id));
  const meeting = meetingById.get(String(scheduled?.meeting_id));
  const label = meeting?.meeting_title || meeting?.meeting_slug || "Não informado";
  if (!evaluationGroups.has(label)) evaluationGroups.set(label, { meeting: label, stars: [], positive: 0, attention: 0, evaluations: 0 });
  const group = evaluationGroups.get(label);
  group.evaluations += 1;
  if (Number.isFinite(Number(evaluation.stars))) group.stars.push(Number(evaluation.stars));
  for (const slug of evaluation.selected_quality_slugs || []) {
    const polarity = qualityBySlug.get(String(slug))?.polarity;
    if (polarity === "positive") group.positive += 1;
    else if (polarity === "negative") group.attention += 1;
  }
}

const assetRows = wealth.slice(0, WEALTH_ASSET_TABLES.length);
const liabilityRows = wealth.slice(WEALTH_ASSET_TABLES.length);
const union = (groups) => {
  const set = new Set();
  groups.forEach((rows) => distinct(rows).forEach((id) => set.add(id)));
  return set;
};
const assetIds = union(assetRows);
const liabilityIds = union(liabilityRows);
const validConnections = connections.filter((row) => allowed(row) && row.is_open_finance === true && row.item_status === "UPDATED");
const openFinanceIds = distinct(validConnections);
const accountIds = distinct(accounts);
const mechanismIds = distinct(mechanisms.filter((row) => row.status === "suggested"));
const formIds = distinct(forms.filter((row) => row.submitted_at));
const paymentIds = distinct(payments.filter((row) => row.paid_at));

console.log(JSON.stringify({
  population: { fetchedAuthUsers: officialFetch.fetched, officialClients: officialSet.size },
  journey: {
    started: progressByUser.size,
    onboardingCompleted: onboardingIds.size,
    completed: completedJourneyIds.size,
    totalDuration: { clients: totalDurations.length, medianDays: median(totalDurations), meanDays: totalDurations.length ? Math.round(totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length * 10) / 10 : null },
    steps: stepStats,
    currentDistribution,
    transitions: transitionStats,
    operationalHealth: {
      unfinished: inactivityDays.length,
      noProgress: inactivityDays.filter((value) => !Number.isFinite(value)).length,
      over7Days: inactivityDays.filter((value) => value > 7).length,
      over15Days: inactivityDays.filter((value) => value > 15).length,
      over30Days: inactivityDays.filter((value) => value > 30).length,
    },
  },
  meetings: {
    scheduledRows: meetings.filter(allowed).length,
    completedRows: meetings.filter((row) => allowed(row) && row.status === "completed").length,
    evaluatedRows: evaluations.filter(allowed).length,
    byType: [...evaluationGroups.values()].map((group) => ({ meeting: group.meeting, evaluations: group.evaluations, averageStars: group.stars.length ? Math.round(group.stars.reduce((a, b) => a + b, 0) / group.stars.length * 10) / 10 : null, positiveHighlights: group.positive, attentionPoints: group.attention })),
  },
  coverage: {
    openFinance: { clients: openFinanceIds.size, coverage: pct(openFinanceIds.size), rows: validConnections.length },
    accounts: { clients: accountIds.size, coverage: pct(accountIds.size), rows: accounts.length },
    assets: { clients: assetIds.size, coverage: pct(assetIds.size), rows: assetRows.reduce((sum, rows) => sum + rows.length, 0) },
    liabilities: { clients: liabilityIds.size, coverage: pct(liabilityIds.size), rows: liabilityRows.reduce((sum, rows) => sum + rows.length, 0) },
    mechanisms: { clients: mechanismIds.size, coverage: pct(mechanismIds.size) },
    forms: { clients: formIds.size, coverage: pct(formIds.size) },
    payments: { clients: paymentIds.size, coverage: pct(paymentIds.size), rows: payments.length },
  },
}, null, 2));
