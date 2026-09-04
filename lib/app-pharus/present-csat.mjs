import { inPeriod, resolvePeriodRange } from "../../js/lib/filters/apply.mjs";
import { percentOf } from "../../js/utils/format.mjs";
import { ratingDistribution, roundCsatAverage } from "./csat-rating.mjs";

function monthKey(value) {
  return String(value || "").slice(0, 7);
}

function matchesSearch(row, search) {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return true;
  return [row.clientName, row.clientEmail, row.clientId, row.subject, row.meetingType, row.comment, row.advisor]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function filterCsatRows(rows, filters = {}) {
  const range = resolvePeriodRange(filters);
  return (rows || []).filter((row) => {
    if (!inPeriod(row.createdAt, range)) return false;
    if (filters.origin && filters.origin !== "all" && row.origin !== filters.origin) return false;
    if (filters.rating && filters.rating !== "all" && String(row.score) !== String(filters.rating)) return false;
    if (filters.screen && filters.screen !== "all") {
      if (row.origin !== "platform" || row.screenKey !== filters.screen) return false;
    }
    if (filters.advisor && filters.advisor !== "all" && String(row.advisorId || "") !== String(filters.advisor)) return false;
    return matchesSearch(row, filters.search);
  });
}

function countTags(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    for (const label of row[key] || []) {
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percent: percentOf(count, total) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

function monthlyTrend(rows) {
  const groups = new Map();
  for (const row of rows) {
    const month = monthKey(row.createdAt);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (!groups.has(month)) groups.set(month, { month, scores: [] });
    if (row.score != null) groups.get(month).scores.push(row.score);
  }
  return [...groups.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({
      month: item.month,
      average: roundCsatAverage(item.scores),
      count: item.scores.length,
    }));
}

function byLabel(rows, labelOf) {
  const groups = new Map();
  for (const row of rows) {
    const label = labelOf(row) || "Não informado";
    if (!groups.has(label)) groups.set(label, { label, scores: [], count: 0 });
    const group = groups.get(label);
    group.count += 1;
    if (row.score != null) group.scores.push(row.score);
  }
  return [...groups.values()]
    .map((group) => ({
      label: group.label,
      count: group.count,
      average: roundCsatAverage(group.scores),
      percent: percentOf(group.count, rows.length),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

function summarize(rows, extras = {}) {
  const scored = rows.filter((row) => row.score != null);
  const positiveScores = scored.filter((row) => row.classification?.bucket === "positive");
  const withImprovement = rows.filter((row) => (row.improvementPoints || []).length > 0);
  const average = roundCsatAverage(scored.map((row) => row.score));
  return {
    evaluations: rows.length,
    average,
    positiveResponses: positiveScores.length,
    positivePercent: percentOf(positiveScores.length, scored.length),
    improvementResponses: withImprovement.length,
    distribution: ratingDistribution(scored.map((row) => row.score)),
    trend: monthlyTrend(rows),
    positivePoints: countTags(rows, "positivePoints"),
    improvementPoints: countTags(rows, "improvementPoints"),
    ...extras,
  };
}

export function presentCsatPage(dataset, filters = {}) {
  const rows = filterCsatRows(dataset.rows || [], filters);
  const meetings = rows.filter((row) => row.origin === "meetings");
  const platform = rows.filter((row) => row.origin === "platform");
  const origin = filters.origin && filters.origin !== "all" ? filters.origin : "all";

  const meetingsSummary = summarize(meetings, {
    byType: byLabel(meetings, (row) => row.meetingType),
    byAdvisor: byLabel(meetings, (row) => row.advisor),
  });
  const platformSummary = summarize(platform, {
    byScreen: byLabel(platform, (row) => row.screenTitle || row.subject)
      .sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
    byScreenImprovement: byLabel(
      platform.filter((row) => (row.improvementPoints || []).length),
      (row) => row.screenTitle || row.subject,
    ),
  });

  const originCards = [
    { origin: "meetings", label: "Reuniões", evaluations: meetingsSummary.evaluations, average: meetingsSummary.average },
    { origin: "platform", label: "Plataforma", evaluations: platformSummary.evaluations, average: platformSummary.average },
  ].filter((card) => origin === "all" || card.origin === origin);

  const kpis = [
    { key: "evaluations", label: "Avaliações", value: rows.length, note: origin === "all" ? "Reuniões e plataforma somadas, ainda como pesquisas distintas." : "Avaliações no recorte." },
    { key: "average", label: "Nota média", value: roundCsatAverage(rows.map((row) => row.score).filter((value) => value != null)), kind: "decimal", digits: 1, note: "Média aritmética das notas registradas." },
    { key: "positive", label: "Respostas positivas", value: rows.filter((row) => row.classification?.bucket === "positive").length, note: "Notas acima de 4. A nota 4 permanece pendente." },
    { key: "improvement", label: "Pontos de melhoria", value: rows.filter((row) => (row.improvementPoints || []).length > 0).length, note: "Avaliações com tags de polaridade improvement no banco." },
  ];

  const quality = dataset.quality || {};
  const notices = [];
  if (quality.meetingsWithoutScore || quality.platformWithoutScore) {
    notices.push("Há avaliações sem nota.");
  }
  if (quality.duplicateMeetingEvaluations || quality.duplicatePlatformPairs) {
    notices.push("Há possíveis duplicidades (mesma reunião ou mesmo par usuário + tela).");
  }
  if (origin !== "meetings" && platform.length && quality.platformWithoutComment === (dataset.platformRows || []).length) {
    notices.push("Os feedbacks da plataforma não trouxeram comentário livre.");
  }

  return {
    kpis,
    originCards,
    meetings: meetingsSummary,
    platform: platformSummary,
    rows,
    advisors: dataset.advisors || [],
    screens: dataset.screens || [],
    quality,
    notices,
    source: dataset.source,
    filters: {
      origin: origin,
      rating: filters.rating || "all",
      screen: filters.screen || "all",
    },
  };
}
