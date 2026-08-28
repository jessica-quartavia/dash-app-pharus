import { filterClients, inPeriod, resolvePeriodRange } from "../../js/lib/filters/apply.mjs";
import { median, percentOf } from "../../js/utils/format.mjs";
import { sortDistributionUnknownLast } from "../../js/utils/sort.mjs";

function distribution(items, labelOf) {
  const counts = new Map();
  for (const item of items || []) {
    const label = labelOf(item) || "Não informado";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const total = items?.length || 0;
  return sortDistributionUnknownLast([...counts].map(([label, count]) => ({ label, count, percent: percentOf(count, total) })));
}

function allowedClientIds(dataset, filters) {
  const clients = filterClients(dataset.clients || [], filters);
  return { clients, ids: new Set(clients.map((client) => String(client.id))) };
}

function daysBetween(from, to) {
  if (!from || !to) return null;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86400000);
}

function monthSeries(rows, dateKey, completedPredicate = null) {
  const counts = new Map();
  for (const row of rows) {
    const month = String(row[dateKey] || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (!counts.has(month)) counts.set(month, { month, scheduled: 0, completed: 0, count: 0 });
    const item = counts.get(month);
    item.count += 1;
    item.scheduled += 1;
    if (completedPredicate?.(row)) item.completed += 1;
  }
  return [...counts.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function presentJourneyPage(dataset, filters = {}) {
  const { clients, ids } = allowedClientIds(dataset, filters);
  const progress = (dataset.progress || []).filter((row) => ids.has(String(row.user_id)));
  const stages = (dataset.stages || []).filter((row) => ids.has(String(row.user_id)));
  const byUser = new Map();
  for (const row of progress) {
    const key = String(row.user_id);
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key).push(row);
  }
  const stageIndex = new Map(stages.map((row) => [String(row.user_id), row.current_stage || "Não informado"]));
  const hasCompleted = (rows, step) => rows.some((row) => row.step === step && row.completed_at);
  const hasReached = (rows, step) => rows.some((row) => row.step === step);
  const reachedCount = (step, completed = true) => [...byUser.values()].filter((rows) => completed ? hasCompleted(rows, step) : hasReached(rows, step)).length;
  const funnel = [
    ["Clientes cadastrados", clients.length],
    ["Diagnóstico concluído", reachedCount("financial_profile")],
    ["Onboarding concluído", reachedCount("complete")],
    ["Rota Patrimonial", reachedCount("patrimony_mapping")],
    ["Ativação das Engrenagens", reachedCount("behavioral_diagnosis")],
    ["Central de Inteligência", reachedCount("intelligence_center", false)],
  ].map(([label, count]) => ({ label, count, percent: percentOf(count, clients.length) }));

  const transitions = [
    ["Diagnóstico → Onboarding", "financial_profile", "completed_at", "complete", "completed_at"],
    ["Onboarding → Rota Patrimonial", "complete", "completed_at", "patrimony_mapping", "completed_at"],
    ["Rota Patrimonial → Ativação", "patrimony_mapping", "completed_at", "behavioral_diagnosis", "completed_at"],
    ["Ativação → Central", "behavioral_diagnosis", "completed_at", "intelligence_center", "created_at"],
  ].map(([label, fromStep, fromKey, toStep, toKey]) => {
    const intervals = [];
    for (const rows of byUser.values()) {
      const from = rows.find((row) => row.step === fromStep)?.[fromKey];
      const to = rows.find((row) => row.step === toStep)?.[toKey];
      const interval = daysBetween(from, to);
      if (interval != null) intervals.push(interval);
    }
    return { label, count: median(intervals), percent: 0, validPairs: intervals.length };
  });

  const nowIso = new Date().toISOString();
  const rows = clients.map((client) => {
    const history = (byUser.get(String(client.id)) || []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const completedDates = history.map((row) => row.completed_at).filter(Boolean).sort();
    const reachedCentral = hasReached(history, "intelligence_center");
    const startedAt = history.map((row) => row.created_at).filter(Boolean).sort()[0] || null;
    const centralAt = history.find((row) => row.step === "intelligence_center")?.created_at || null;
    const lastProgressAt = completedDates.at(-1) || null;
    return { ...client, journeyStage: stageIndex.get(String(client.id)) || "Não informado", journeyStartedAt: startedAt, journeyCompletedAt: centralAt, lastActivityAt: lastProgressAt, daysInStage: daysBetween(lastProgressAt || startedAt, nowIso), journeyComplete: reachedCentral, journeyProgress: clients.length ? (history.filter((row) => row.completed_at).length / 8) * 100 : 0 };
  });
  const completedRows = rows.filter((row) => row.journeyComplete);
  const totalDurations = completedRows.map((row) => daysBetween(row.journeyStartedAt, row.journeyCompletedAt)).filter((value) => value != null);
  const unfinished = rows.filter((row) => !row.journeyComplete);
  const health = [
    { label: "Sem avanço registrado", count: unfinished.filter((row) => !row.lastActivityAt).length },
    { label: "Parados há mais de 7 dias", count: unfinished.filter((row) => row.daysInStage > 7).length },
    { label: "Parados há mais de 15 dias", count: unfinished.filter((row) => row.daysInStage > 15).length },
    { label: "Parados há mais de 30 dias", count: unfinished.filter((row) => row.daysInStage > 30).length },
  ].map((item) => ({ ...item, percent: percentOf(item.count, clients.length) }));
  return {
    kpis: [
      { label: "Clientes válidos", value: clients.length, note: "População oficial no recorte" },
      { label: "Onboarding concluído", value: reachedCount("complete"), note: "step = complete e completed_at preenchido" },
      { label: "Jornada completa", value: completedRows.length, note: "Chegaram à Central de Inteligência" },
      { label: "Tempo total mediano", value: median(totalDurations), kind: "days", note: `${totalDurations.length} clientes com cronologia completa` },
    ],
    funnel,
    byStage: distribution(rows, (row) => row.journeyStage),
    transitions,
    health,
    rows,
    advisors: dataset.advisors || [],
    source: dataset.source,
  };
}

export function presentMeetingsPage(dataset, filters = {}) {
  const { clients, ids } = allowedClientIds(dataset, filters);
  const range = resolvePeriodRange(filters);
  const rows = (dataset.rows || []).filter((row) => ids.has(String(row.clientId)) && inPeriod(row.date, range));
  const completed = rows.filter((row) => row.status === "completed");
  const evaluated = rows.filter((row) => row.score != null);
  const averageScore = evaluated.length ? evaluated.reduce((sum, row) => sum + row.score, 0) / evaluated.length : null;
  const evaluationMap = new Map();
  for (const row of evaluated) {
    if (!evaluationMap.has(row.type)) evaluationMap.set(row.type, { label: row.type, scores: [], positive: 0, attention: 0 });
    const group = evaluationMap.get(row.type);
    group.scores.push(row.score);
    group.positive += row.highlights.length;
    group.attention += row.attentionPoints.length;
  }
  const evaluationsByType = [...evaluationMap.values()].map((group) => ({ label: group.label, score: group.scores.reduce((a, b) => a + b, 0) / group.scores.length, evaluations: group.scores.length, positive: group.positive, attention: group.attention }));
  return {
    kpis: [
      { label: "Reuniões agendadas", value: rows.length, note: "core.scheduled_meetings" },
      { label: "Realizadas", value: completed.length, note: "status = completed" },
      { label: "Comparecimento", value: percentOf(completed.length, rows.length), kind: "percent", note: "Realizadas sobre agendadas" },
      { label: "Avaliações", value: evaluated.length, note: "Avaliações realmente registradas" },
      { label: "Nota média", value: averageScore, kind: "decimal", note: averageScore == null ? "Sem avaliações" : "Média das avaliações registradas" },
      { label: "Destaques positivos", value: evaluated.reduce((sum, row) => sum + row.highlights.length, 0), note: "Dimensões positivas selecionadas" },
      { label: "Pontos de atenção", value: evaluated.reduce((sum, row) => sum + row.attentionPoints.length, 0), note: "Dimensões negativas selecionadas" },
    ],
    monthly: monthSeries(rows, "date", (row) => row.status === "completed"),
    byType: distribution(rows, (row) => row.type),
    byStatus: distribution(rows, (row) => row.status),
    scores: distribution(evaluated, (row) => `${row.score} de 5`),
    evaluationsByType,
    rows,
    clients,
    advisors: dataset.advisors || [],
    source: dataset.source,
  };
}

export function presentWealthPage(dataset, filters = {}) {
  const { clients, ids } = allowedClientIds(dataset, filters);
  const rows = (dataset.rows || []).filter((row) => ids.has(String(row.id)));
  const withWealth = rows.filter((row) => row.wealth?.hasAssets);
  const withFinancialData = rows.filter((row) => row.wealth);
  const assets = withFinancialData.reduce((sum, row) => sum + row.wealth.assets, 0);
  const liabilities = withFinancialData.reduce((sum, row) => sum + row.wealth.liabilities, 0);
  const classTotals = new Map();
  for (const row of withFinancialData) {
    for (const [label, value] of Object.entries(row.wealth.classes || {})) {
      classTotals.set(label, (classTotals.get(label) || 0) + Number(value || 0));
    }
  }
  const liabilityLabels = new Set((dataset.totalsByClass || []).filter((item) => item.liability).map((item) => item.label));
  const classRows = [...classTotals].map(([label, total]) => ({ label, total, liability: liabilityLabels.has(label) }));
  const completeness = rows.map((row) => {
    const domains = [Boolean(row.wealth?.hasAssets), Boolean(row.wealth?.hasLiabilities), Boolean(row.hasOpenFinance)];
    const covered = domains.filter(Boolean).length;
    return covered === 3 ? "Completo" : covered > 0 ? "Incompleto" : "Sem dados";
  });
  return {
    kpis: [
      { label: "Patrimônio bruto", value: assets, kind: "currency", note: "Valores atuais cadastrados" },
      { label: "Passivos", value: liabilities, kind: "currency", note: "Saldo devedor cadastrado" },
      { label: "Patrimônio líquido", value: assets - liabilities, kind: "currency", note: "Ativos menos passivos" },
      { label: "Clientes com patrimônio", value: withWealth.length, note: `${percentOf(withWealth.length, clients.length).toFixed(1)}% da base no recorte` },
      { label: "Patrimônio mediano", value: median(withWealth.map((row) => row.wealth.assets)), kind: "currency", note: "Por cliente com dado" },
    ],
    composition: classRows.filter((item) => !item.liability).map((item) => ({ label: item.label, count: item.total, percent: percentOf(item.total, assets) })),
    liabilities: classRows.filter((item) => item.liability).map((item) => ({ label: item.label, count: item.total, percent: percentOf(item.total, liabilities) })),
    completeness: distribution(completeness.map((status) => ({ status })), (item) => item.status),
    rows,
    completenessRule: dataset.completenessRule,
    advisors: dataset.advisors || [],
    source: dataset.source,
  };
}

export function presentOpenFinancePage(dataset, filters = {}) {
  const { clients, ids } = allowedClientIds(dataset, filters);
  const range = resolvePeriodRange(filters);
  const rows = (dataset.rows || []).filter((row) => ids.has(String(row.clientId)) && inPeriod(row.createdAt, range));
  const valid = rows.filter((row) => row.isOpenFinance === true && row.status === "UPDATED");
  const connected = new Set(valid.map((row) => String(row.clientId)));
  const uniqueConnectedAccounts = new Map();
  for (const account of dataset.accounts || []) {
    if (!connected.has(String(account.user_id))) continue;
    const accountId = account.id ?? account.item_id;
    const key = accountId == null
      ? `${String(account.user_id)}:${String(account.name || "")}:${String(account.type || account.subtype || "")}`
      : String(accountId);
    if (!uniqueConnectedAccounts.has(key)) uniqueConnectedAccounts.set(key, account);
  }
  const connectedAccounts = uniqueConnectedAccounts.size;
  const averageAccountsPerClient = connected.size ? connectedAccounts / connected.size : null;
  return {
    kpis: [
      { label: "Clientes conectados", value: connected.size, note: "is_open_finance = true e item_status = UPDATED" },
      { label: "Conexões válidas", value: valid.length, note: "Conexões aprovadas pela regra oficial" },
      { label: "Contas conectadas", value: connectedAccounts, note: "Registros únicos de core.accounts dos clientes conectados" },
      { label: "Média de contas por cliente", value: averageAccountsPerClient, kind: "decimal", digits: 0, note: "Média entre clientes conectados" },
      { label: "Cobertura", value: percentOf(connected.size, clients.length), kind: "percent", note: "Clientes conectados sobre população do recorte" },
      { label: "Com erro", value: rows.filter((row) => row.status === "ERROR" || row.errorCode).length, note: "Erros realmente retornados" },
    ],
    monthly: monthSeries(valid, "createdAt"),
    status: distribution(rows, (row) => row.result || row.status),
    institutions: distribution(valid, (row) => row.institution),
    accountTypes: distribution(valid.flatMap((row) => row.accountTypes.map((type) => ({ type }))), (row) => row.type),
    rows,
    advisors: dataset.advisors || [],
    source: dataset.source,
  };
}

export function presentFormsPage(dataset, filters = {}) {
  const { clients, ids } = allowedClientIds(dataset, filters);
  const range = resolvePeriodRange(filters);
  const rows = (dataset.rows || []).filter((row) => ids.has(String(row.clientId)) && inPeriod(row.startedAt, range));
  const completed = rows.filter((row) => row.completedAt);
  const responders = new Set(completed.map((row) => String(row.clientId)));
  return {
    kpis: [
      { label: "Formulários disponíveis", value: dataset.forms.length, note: "core.forms" },
      { label: "Respostas iniciadas", value: rows.length, note: "core.form_submissions" },
      { label: "Respostas concluídas", value: completed.length, note: "submitted_at preenchido" },
      { label: "Taxa de conclusão", value: percentOf(completed.length, rows.length), kind: "percent", note: "Concluídas sobre iniciadas" },
      { label: "Clientes respondentes", value: responders.size, note: `${percentOf(responders.size, clients.length).toFixed(1)}% da base no recorte` },
    ],
    byForm: distribution(rows, (row) => row.formName),
    monthly: monthSeries(rows, "startedAt"),
    completion: distribution(rows, (row) => row.status),
    rows,
    advisors: dataset.advisors || [],
    source: dataset.source,
  };
}

export function presentPaymentsPage(dataset, filters = {}) {
  const { clients, ids } = allowedClientIds(dataset, filters);
  const range = resolvePeriodRange(filters);
  const rows = (dataset.rows || []).filter((row) => ids.has(String(row.clientId)) && inPeriod(row.date, range));
  const paidClients = new Set(rows.filter((row) => row.date).map((row) => String(row.clientId)));
  return {
    kpis: [
      { label: "Clientes com registro", value: paidClients.size, note: "core.user_payments" },
      { label: "Registros de pagamento", value: rows.length, note: "Registros no período" },
      { label: "Cobertura", value: percentOf(paidClients.size, clients.length), kind: "percent", note: "Clientes com registro sobre a base" },
      { label: "Último pagamento", value: rows.map((row) => row.date).filter(Boolean).sort().at(-1) || null, kind: "date", note: "Data mais recente" },
    ],
    monthly: monthSeries(rows, "date"),
    rows,
    amountAvailable: dataset.amountAvailable,
    advisors: dataset.advisors || [],
    source: dataset.source,
  };
}
