/**
 * Camada de dados do dashboard.
 * Nesta etapa lê mocks. A interface deve permanecer estável quando
 * as chamadas reais ao App Pharus forem conectadas.
 */
import {
  ACCOUNT_TYPES,
  CLIENTS,
  FORM_CATALOG,
  FORM_SUBMISSIONS,
  FORMS_MONTHLY,
  JOURNEY_STAGES,
  MECHANISM_CATALOG,
  MEETINGS,
  MEETINGS_MONTHLY,
  MEETING_TYPES,
  OPEN_FINANCE_CASHFLOW,
  OPEN_FINANCE_CONNECTIONS,
  OPEN_FINANCE_EXPENSES,
  OPEN_FINANCE_MONTHLY,
  PAYMENTS,
  PAYMENTS_MONTHLY,
  PROCESSED_TRANSACTIONS,
  USER_MECHANISMS,
  WEALTH_BY_CLIENT,
  WEALTH_CLASSES,
  WEALTH_MONTHLY,
} from "../data/mocks/index.mjs";
import { filterClients, inPeriod, resolvePeriodRange } from "../lib/filters/apply.mjs";
import {
  coverageTone,
  daysBetween,
  formatPercent,
  median,
  percentOf,
} from "../utils/format.mjs";
import { sortDistributionUnknownLast } from "../utils/sort.mjs";

const LOAD_DELAY_MS = 80;

function wait() {
  return new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
}

function wealthTotals(entry) {
  if (!entry) return null;
  const investments =
    entry.equities + entry.fixedIncome + entry.funds + entry.pensions + entry.otherInvestments;
  const realEstate = entry.realEstate;
  const otherAssets = entry.movable + entry.consortia;
  const liabilities = entry.financings + entry.loans;
  const assets = investments + realEstate + otherAssets;
  return {
    ...entry,
    investments,
    realEstate,
    otherAssets,
    liabilities,
    financings: entry.financings,
    loans: entry.loans,
    total: assets,
    net: assets - liabilities,
    financial: investments,
  };
}

function enrichClient(client) {
  const wealth = wealthTotals(WEALTH_BY_CLIENT[client.id]);
  const mechanisms = USER_MECHANISMS[client.id];
  const available = MECHANISM_CATALOG.length;
  const implemented = mechanisms?.implemented?.length || 0;
  return {
    ...client,
    wealth,
    wealthTotal: wealth?.total ?? null,
    wealthNet: wealth?.net ?? null,
    mechanismsAvailable: available,
    mechanismsImplemented: implemented,
    mechanismRate: available ? (implemented / available) * 100 : 0,
    firstMechanismAt: mechanisms?.firstAt || null,
    lastMechanismAt: mechanisms?.lastAt || null,
    mechanismUpdatedAt: mechanisms?.updatedAt || null,
  };
}

function distribution(items, getLabel) {
  const counts = new Map();
  for (const item of items) {
    const label = getLabel(item) || "Não informado";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const total = items.length || 1;
  return sortDistributionUnknownLast(
    [...counts.entries()].map(([label, count]) => ({
      label,
      count,
      percent: percentOf(count, total),
    })),
  );
}

function coverage(clients, predicate) {
  const withData = clients.filter(predicate).length;
  const withoutData = clients.length - withData;
  const percent = percentOf(withData, clients.length);
  return { withData, withoutData, percent, tone: coverageTone(percent) };
}

function kpiNote(part, total, goodWhenHigh = true) {
  const pct = percentOf(part, total);
  const tone = goodWhenHigh ? coverageTone(pct) : coverageTone(100 - pct);
  const label = tone === "good" ? "cobertura boa" : tone === "warn" ? "atenção" : "cobertura crítica";
  return {
    note: `${formatPercent(pct)} da base · ${label}`,
    tone,
    percent: pct,
  };
}

export async function getFilteredClients(filters) {
  await wait();
  return filterClients(CLIENTS, filters).map(enrichClient);
}

export { getClientById, getClientsDataset, getClientsPage } from "./app-pharus/clients.mjs";

function wealthBucket(total) {
  if (total == null) return "Não informado";
  if (total < 250000) return "Até R$ 250 mil";
  if (total < 750000) return "R$ 250 mil a R$ 750 mil";
  if (total < 1500000) return "R$ 750 mil a R$ 1,5 mi";
  return "Acima de R$ 1,5 mi";
}

export async function getWealthPage(filters) {
  const clients = await getFilteredClients(filters);
  const withWealth = clients.filter((c) => c.wealth);
  const totals = withWealth.map((c) => c.wealth);
  const sum = (key) => totals.reduce((acc, item) => acc + (item[key] || 0), 0);
  const total = sum("total");
  const composition = WEALTH_CLASSES.filter((item) => !item.liability).map((item) => {
    const count = sum(item.key);
    return { label: item.label, count, percent: percentOf(count, total) };
  });
  const byClass = sortDistributionUnknownLast(composition);
  const buckets = distribution(withWealth, (c) => wealthBucket(c.wealthTotal));
  return {
    kpis: [
      { label: "Patrimônio total", value: total, kind: "currency", note: `${withWealth.length} clientes com cadastro` },
      { label: "Patrimônio mediano", value: median(withWealth.map((c) => c.wealthTotal)), kind: "currency", note: "Por cliente com dado" },
      { label: "Patrimônio financeiro", value: sum("financial"), kind: "currency", note: "Investimentos financeiros" },
      { label: "Patrimônio imobiliário", value: sum("realEstate"), kind: "currency", note: "Imóveis cadastrados" },
      { label: "Investimentos", value: sum("investments"), kind: "currency", note: "RV, RF, fundos e previdência" },
      { label: "Saldo devedor", value: sum("liabilities"), kind: "currency", note: "Financiamentos e empréstimos", highlight: true },
      { label: "Clientes com patrimônio", value: withWealth.length, ...kpiNote(withWealth.length, clients.length) },
      { label: "Cobertura patrimonial", value: percentOf(withWealth.length, clients.length), kind: "percent", ...kpiNote(withWealth.length, clients.length) },
    ],
    composition: byClass,
    byClass,
    buckets,
    evolution: WEALTH_MONTHLY.map((item) => ({ month: item.month, count: item.total })),
    assetsLiabilities: [
      { month: "2026-03", assets: 13200000, liabilities: 2100000 },
      { month: "2026-04", assets: 13600000, liabilities: 2150000 },
      { month: "2026-05", assets: 13900000, liabilities: 2180000 },
      { month: "2026-06", assets: 14300000, liabilities: 2200000 },
      { month: "2026-07", assets: 14700000, liabilities: 2240000 },
      { month: "2026-08", assets: 15170000, liabilities: 2280000 },
    ],
    rows: withWealth.length
      ? withWealth
      : clients.map((c) => ({ ...c, wealth: null })),
  };
}

export async function getOpenFinancePage(filters) {
  const clients = await getFilteredClients(filters);
  const ids = new Set(clients.map((c) => c.id));
  const connections = OPEN_FINANCE_CONNECTIONS.filter((item) => ids.has(item.clientId));
  const connectedClients = clients.filter((c) => c.hasOpenFinance).length;
  const health = {
    Saudável: connections.filter((c) => c.health === "Saudável").length,
    Atenção: connections.filter((c) => c.health === "Atenção").length,
    Falha: connections.filter((c) => c.health === "Falha").length,
  };
  const lastSync = connections
    .map((item) => item.lastSyncAt)
    .sort()
    .at(-1);
  return {
    kpis: [
      { label: "Clientes conectados", value: connectedClients, ...kpiNote(connectedClients, clients.length) },
      { label: "Conexões ativas", value: connections.filter((c) => c.status === "Ativa").length, note: "Instituições com status ativo" },
      { label: "Contas conectadas", value: connections.reduce((acc, item) => acc + item.accounts, 0), note: "Soma das contas no recorte" },
      { label: "Transações processadas", value: PROCESSED_TRANSACTIONS, note: "Volume acumulado de demonstração" },
      { label: "Conexões com sucesso", value: connections.filter((c) => c.result === "Sucesso").length, ...kpiNote(connections.filter((c) => c.result === "Sucesso").length, connections.length || 1) },
      { label: "Sucesso parcial", value: connections.filter((c) => c.result === "Sucesso parcial").length, note: "Exigem revisão da sincronização", tone: "warn" },
      { label: "Com problema", value: connections.filter((c) => c.result === "Problema").length, note: "Integração sem dado útil", tone: "critical" },
      { label: "Última sincronização", value: lastSync || null, kind: "datetime", note: "Mais recente do recorte" },
    ],
    monthly: OPEN_FINANCE_MONTHLY,
    status: distribution(connections, (c) => c.result),
    institutions: distribution(connections, (c) => c.institution),
    accountTypes: distribution(
      connections.flatMap((c) => c.accountTypes.map((type) => ({ type }))),
      (item) => item.type,
    ).concat(
      ACCOUNT_TYPES.filter((type) => !connections.some((c) => c.accountTypes.includes(type))).map((label) => ({
        label,
        count: 0,
        percent: 0,
      })),
    ).filter((item, index, list) => list.findIndex((other) => other.label === item.label) === index),
    cashflow: OPEN_FINANCE_CASHFLOW,
    expenses: OPEN_FINANCE_EXPENSES,
    health,
    rows: connections.map((item) => {
      const client = clients.find((c) => c.id === item.clientId);
      return { ...item, clientName: client?.name || item.clientId };
    }),
  };
}

export async function getMeetingsPage(filters) {
  const clients = await getFilteredClients(filters);
  const ids = new Set(clients.map((c) => c.id));
  const range = resolvePeriodRange(filters);
  const meetings = MEETINGS.filter((item) => ids.has(item.clientId) && inPeriod(item.date, range));
  const scheduled = meetings.length;
  const done = meetings.filter((m) => m.status === "Realizada").length;
  const noShow = meetings.filter((m) => m.status === "No-show").length;
  const perClient = clients.map((c) => meetings.filter((m) => m.clientId === c.id).length);
  const intervals = [];
  for (const client of clients) {
    const dates = meetings
      .filter((m) => m.clientId === client.id && m.status === "Realizada")
      .map((m) => m.date)
      .sort();
    for (let i = 1; i < dates.length; i += 1) {
      const gap = daysBetween(dates[i - 1], dates[i]);
      if (gap != null) intervals.push(gap);
    }
  }
  const lastMeeting = meetings.map((m) => m.date).sort().at(-1);
  const recentCutoff = "2026-06-01";
  const withoutRecent = clients.filter((c) => {
    const last = meetings.filter((m) => m.clientId === c.id && m.status === "Realizada").map((m) => m.date).sort().at(-1);
    return !last || last < recentCutoff;
  }).length;
  const scores = distribution(
    meetings.filter((m) => m.score != null),
    (m) => `${m.score} de 5`,
  );
  return {
    kpis: [
      { label: "Reuniões agendadas", value: scheduled, note: "No recorte de período" },
      { label: "Realizadas", value: done, ...kpiNote(done, scheduled || 1) },
      { label: "Comparecimento", value: percentOf(done, scheduled || 1), kind: "percent", ...kpiNote(done, scheduled || 1) },
      { label: "No-show", value: noShow, note: `${formatPercent(percentOf(noShow, scheduled || 1))} das reuniões`, tone: noShow ? "warn" : "good" },
      { label: "Reuniões por cliente", value: median(perClient) ?? 0, note: "Mediana no recorte" },
      { label: "Intervalo mediano", value: median(intervals), kind: "days", note: "Entre reuniões realizadas" },
      { label: "Última reunião", value: lastMeeting, kind: "date", note: "Mais recente do recorte" },
      { label: "Sem reunião recente", value: withoutRecent, ...kpiNote(clients.length - withoutRecent, clients.length) },
    ],
    monthly: MEETINGS_MONTHLY,
    byType: distribution(meetings, (m) => m.type || "Não informado"),
    byStatus: distribution(meetings, (m) => m.status),
    intervals: [
      { label: "Até 30 dias", count: intervals.filter((n) => n <= 30).length, percent: 0 },
      { label: "31 a 90 dias", count: intervals.filter((n) => n > 30 && n <= 90).length, percent: 0 },
      { label: "Mais de 90 dias", count: intervals.filter((n) => n > 90).length, percent: 0 },
    ].map((item, _, list) => ({ ...item, percent: percentOf(item.count, list.reduce((a, b) => a + b.count, 0) || 1) })),
    scores,
    types: MEETING_TYPES,
    rows: meetings.map((item) => ({
      ...item,
      clientName: clients.find((c) => c.id === item.clientId)?.name || item.clientId,
    })),
  };
}

export async function getFormsPage(filters) {
  const clients = await getFilteredClients(filters);
  const ids = new Set(clients.map((c) => c.id));
  const range = resolvePeriodRange(filters);
  const rows = FORM_SUBMISSIONS.filter(
    (item) => ids.has(item.clientId) && inPeriod(item.startedAt, range),
  ).map((item) => ({
    ...item,
    formName: FORM_CATALOG.find((form) => form.id === item.formId)?.name || item.formId,
    clientName: clients.find((c) => c.id === item.clientId)?.name || item.clientId,
  }));
  const started = rows.length;
  const completed = rows.filter((item) => item.status === "Concluído").length;
  const without = clients.filter((c) => !c.hasForms).length;
  const byForm = FORM_CATALOG.map((form) => {
    const list = rows.filter((item) => item.formId === form.id);
    return { label: form.name, count: list.length, percent: percentOf(list.filter((i) => i.status === "Concluído").length, list.length || 1) };
  });
  const profiles = distribution(
    rows.filter((item) => item.profile),
    (item) => item.profile,
  );
  return {
    kpis: [
      { label: "Formulários disponíveis", value: FORM_CATALOG.length, note: "Quiz e alinhamento" },
      { label: "Iniciados", value: started, note: "No recorte de período" },
      { label: "Concluídos", value: completed, ...kpiNote(completed, started || 1) },
      { label: "Taxa de conclusão", value: percentOf(completed, started || 1), kind: "percent", ...kpiNote(completed, started || 1) },
      { label: "Clientes sem resposta", value: without, ...kpiNote(clients.length - without, clients.length) },
      { label: "Respostas recentes", value: rows.filter((item) => item.startedAt >= "2026-07-01").length, note: "Inícios desde julho/2026" },
    ],
    byForm,
    monthly: FORMS_MONTHLY,
    completion: [
      { label: "Concluído", count: completed, percent: percentOf(completed, started || 1) },
      { label: "Iniciado", count: started - completed, percent: percentOf(started - completed, started || 1) },
    ],
    profiles,
    rows,
  };
}

export async function getJourneyPage(filters) {
  const clients = await getFilteredClients(filters);
  const started = clients.filter((c) => c.hasJourney);
  const completed = clients.filter((c) => c.journeyStage === "Concluída");
  const byStage = JOURNEY_STAGES.map((stage) => {
    const count = clients.filter((c) => c.journeyStage === stage).length;
    return { label: stage, count, percent: percentOf(count, clients.length) };
  });
  const peak = [...byStage].sort((a, b) => b.count - a.count)[0];
  const drop = byStage.slice(0, -1).reduce((worst, step, index) => {
    const next = byStage[index + 1];
    const dropCount = step.count - next.count;
    if (dropCount > (worst?.drop || 0)) return { from: step.label, to: next.label, drop: dropCount };
    return worst;
  }, null);
  const completionDays = completed
    .map((c) => daysBetween(c.journeyStartedAt, c.journeyCompletedAt))
    .filter((n) => n != null);
  const advance = byStage.slice(0, -1).map((step, index) => {
    const next = byStage[index + 1];
    return {
      label: `${step.label} → ${next.label}`,
      count: next.count,
      percent: percentOf(next.count, step.count || 1),
    };
  });
  return {
    kpis: [
      { label: "Jornada iniciada", value: started.length, ...kpiNote(started.length, clients.length) },
      { label: "Jornada concluída", value: completed.length, ...kpiNote(completed.length, clients.length) },
      { label: "% de conclusão", value: percentOf(completed.length, started.length || 1), kind: "percent", ...kpiNote(completed.length, started.length || 1) },
      { label: "Estágio mais populoso", value: peak?.label || "—", kind: "text", note: `${peak?.count || 0} clientes` },
      { label: "Maior ponto de abandono", value: drop ? `${drop.from}` : "—", kind: "text", note: drop ? `${drop.drop} clientes não avançam para ${drop.to}` : "Sem recorte" },
      { label: "Tempo mediano de conclusão", value: median(completionDays), kind: "days", note: "Entre início e conclusão" },
    ],
    funnel: byStage,
    byStage,
    advance,
    rows: clients,
  };
}

export async function getPaymentsPage(filters) {
  const clients = await getFilteredClients(filters);
  const ids = new Set(clients.map((c) => c.id));
  const range = resolvePeriodRange(filters);
  const payments = PAYMENTS.filter((item) => ids.has(item.clientId) && inPeriod(item.date, range));
  const withPay = new Set(payments.map((item) => item.clientId));
  const total = payments.reduce((acc, item) => acc + item.amount, 0);
  return {
    kpis: [
      { label: "Clientes com pagamento", value: withPay.size, ...kpiNote(withPay.size, clients.length) },
      { label: "Valor total registrado", value: total, kind: "currency", note: "Valores do App — não é receita oficial" },
      { label: "Ticket mediano", value: median(payments.map((item) => item.amount)), kind: "currency", note: "Por pagamento no recorte" },
      { label: "Pagamentos recentes", value: payments.filter((item) => item.date >= "2026-07-01").length, note: "Desde julho/2026" },
      { label: "Sem pagamento identificado", value: clients.length - withPay.size, ...kpiNote(withPay.size, clients.length) },
    ],
    monthly: PAYMENTS_MONTHLY,
    rows: payments.map((item) => ({
      ...item,
      clientName: clients.find((c) => c.id === item.clientId)?.name || item.clientId,
    })),
  };
}

export async function getQualityPage(filters) {
  const { getClientsDataset } = await import("./app-pharus/clients.mjs");
  const dataset = await getClientsDataset();
  const clients = filterClients(dataset.clients || [], filters, { dateField: "registeredAt" });
  const domains = [
    { domain: "Cadastro", source: "Base oficial do App Pharus", predicate: () => true },
    { domain: "Patrimônio", source: "Clientes com ativos cadastrados", predicate: (c) => c.hasWealth },
    { domain: "Open Finance", source: "Clientes com conexão válida", predicate: (c) => c.hasOpenFinance },
    { domain: "Mecanismos", source: "Clientes com mecanismos implementados", predicate: (c) => c.hasMechanisms },
    { domain: "Reuniões", source: "Clientes com reunião realizada", predicate: (c) => c.hasMeetings },
    { domain: "Formulários", source: "Clientes que responderam formulário", predicate: (c) => c.hasForms },
    { domain: "Progresso", source: "Clientes com jornada iniciada", predicate: (c) => c.hasJourney },
  ].map((item) => {
    const stats = coverage(clients, item.predicate);
    return {
      ...item,
      ...stats,
      updatedAt: null,
    };
  });
  return { domains, total: clients.length };
}
