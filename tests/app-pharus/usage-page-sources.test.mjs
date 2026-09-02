import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYTICS_FALLBACK,
  ANALYTICS_LOADING,
  EXPO_FALLBACK,
  EXPO_LOADING,
  PHARUS_FALLBACK,
  loadUsageSources,
  mergeUsageSources,
  retryUsageSource,
  withTimeout,
} from "../../js/services/app-pharus/usage-sources.mjs";
import { renderUtilizacaoApp } from "../../js/pages/utilizacao-app-view.mjs";
import { formatDurationSeconds } from "../../js/utils/format.mjs";

const analyticsOk = {
  available: true,
  integration: { authenticated: true, propertyResolved: true, propertyId: "539536052" },
  availability: {
    metrics: {
      active1DayUsers: true,
      active7DayUsers: true,
      active28DayUsers: true,
      sessions: true,
      newUsers: true,
      sessionsPerUser: true,
    },
  },
  summary: {
    active1DayUsers: 19,
    active7DayUsers: 100,
    active28DayUsers: 415,
    sessions: 1902,
    newUsers: 355,
    sessionsPerUser: 4.23,
  },
  usageSeries: [{ date: "2026-09-01", count: 19 }],
  events: [{ name: "page_view", count: 9759, percent: 50 }],
  engagement: {
    sessionsPerUser: 4.23,
    averageSessionDuration: 657,
    averageEngagementPerActiveUser: 780,
    averageEngagementPerActiveUserSource: "userEngagementDuration / activeUsers",
  },
  classification: { kind: "web", WEB: 450, ANDROID: null, IOS: null, other: [] },
  period: { startDate: "2026-08-03", endDate: "2026-09-01" },
};

const expoOk = {
  available: true,
  integration: { authenticated: true, projectResolved: true },
  usageKpis: [{ key: "embedded_unique_users", label: "Usuários únicos (update embarcado)", status: "ok", kind: "number", value: 61 }],
  headlineKpis: [
    { key: "unique_users_7d", status: "unavailable", value: "Não disponível" },
    { key: "launches", status: "ok", kind: "number", value: 0 },
  ],
  usageSeries: [{ date: "2026-08-20", count: 6 }],
  usageSeriesStatus: "available",
  versionRows: [{ version: "1.2.1", platform: "ANDROID", events: 890, percent: 40 }],
  builds: [{ id: "b1", platform: "IOS", version: "1.2.1", status: "FINISHED", createdAt: "2026-08-20" }],
  channels: [{ name: "production" }],
  updates: [{ id: "u1", channel: "production", branch: "main", runtimeVersion: "abc", updatedAt: "2026-08-20" }],
  channelInsights: [{ channel: "production", runtimeVersion: "abc", embeddedUsers: 61, otaUsers: 0, responded: true }],
  updateInsights: [],
  observe: { configured: true, performanceRows: [], totalEvents: 4087 },
  availability: { channelInsights: "ok", observe: "ok" },
  capabilities: {
    channels: true,
    runtimes: true,
    versions: true,
    updateInsights: true,
    channelInsights: true,
    builds: true,
    observe: true,
  },
  runtimes: [{ id: "r1", channel: "production", branch: "main", runtimeVersion: "abc" }],
};

const pharusOk = {
  available: true,
  kpis: [
    { key: "official", label: "Clientes oficiais", value: 400 },
    { key: "openFinance", label: "Com Open Finance", value: 74 },
    { key: "mechanisms", label: "Com mecanismos", value: 80 },
    { key: "wealth", label: "Com patrimônio", value: 90 },
    { key: "meetings", label: "Com reuniões", value: 50 },
    { key: "journey", label: "Com jornada iniciada", value: 60 },
  ],
};

test("fontes independentes: GA4 OK + Expo OK", () => {
  const page = mergeUsageSources({ analytics: analyticsOk, expo: expoOk, pharus: pharusOk });
  assert.equal(page.sources.analytics, "connected");
  assert.equal(page.sources.expo, "connected");
  assert.equal(page.sources.pharus, "connected");
  const html = renderUtilizacaoApp(page);
  assert.match(html, /Usuários ativos · 1 dia/);
  assert.match(html, />19</);
  assert.match(html, /13 min/);
  assert.match(html, /10 min 57 s/);
  assert.match(html, /is-featured/);
  assert.match(html, /Quantidade de usuários distintos que utilizaram a plataforma nos últimos 7 dias/);
  assert.match(html, /5\. Versões do App/);
  assert.doesNotMatch(html, /5\. Uso do aplicativo/);
  assert.doesNotMatch(html, /Usuários únicos por dia/);
  assert.doesNotMatch(html, /Usuários únicos \(update embarcado\)/);
  assert.doesNotMatch(html, /Usuários únicos \(OTA\)/);
  assert.doesNotMatch(html, /Instalações com falha/);
  assert.doesNotMatch(html, /Usuários únicos · 7 dias/);
  assert.doesNotMatch(html, /Integração Expo temporariamente indisponível/);
});

test("fontes independentes: GA4 OK + Expo ERROR", () => {
  const page = mergeUsageSources({ analytics: analyticsOk, expo: EXPO_FALLBACK, pharus: pharusOk });
  assert.equal(page.sources.analytics, "connected");
  assert.equal(page.sources.expo, "error");
  const html = renderUtilizacaoApp(page);
  assert.match(html, /1\. Utilização da plataforma/);
  assert.match(html, /100/);
  assert.match(html, /415/);
  assert.match(html, /Google Analytics · conectado/);
  assert.match(html, /Expo \/ EAS · erro/);
  assert.match(html, /Não foi possível carregar os dados técnicos do Expo\/EAS/);
  assert.match(html, /data-retry-source="expo"/);
  assert.doesNotMatch(html, /Não foi possível carregar esta página/);
  assert.doesNotMatch(html, /Usuários únicos 7 dias/);
});

test("fontes independentes: GA4 ERROR + Expo OK", () => {
  const page = mergeUsageSources({ analytics: ANALYTICS_FALLBACK, expo: expoOk, pharus: pharusOk });
  assert.equal(page.sources.analytics, "error");
  assert.equal(page.sources.expo, "connected");
  const html = renderUtilizacaoApp(page);
  assert.match(html, /Não foi possível carregar as métricas de utilização/);
  assert.match(html, /data-retry-source="analytics"/);
  assert.match(html, /5\. Versões do App/);
  assert.match(html, /1\.2\.1/);
  assert.doesNotMatch(html, /Usuários únicos por dia/);
  assert.doesNotMatch(html, /Usuários ativos · 1 dia/);
});

test("fontes independentes: ambas indisponíveis", () => {
  const page = mergeUsageSources({ analytics: ANALYTICS_FALLBACK, expo: EXPO_FALLBACK, pharus: PHARUS_FALLBACK });
  assert.equal(page.sources.analytics, "error");
  assert.equal(page.sources.expo, "error");
  assert.equal(page.sources.pharus, "error");
  const html = renderUtilizacaoApp(page);
  assert.match(html, /Não foi possível carregar as métricas de utilização/);
  assert.match(html, /Não foi possível carregar os dados técnicos do Expo\/EAS/);
  assert.match(html, /Não foi possível carregar o contexto da base Pharus/);
  assert.doesNotMatch(html, /Não disponível pela integração atual do Expo/);
});

test("KPI não suportado não ocupa espaço", () => {
  const html = renderUtilizacaoApp(mergeUsageSources({ analytics: analyticsOk, expo: expoOk, pharus: pharusOk }));
  assert.doesNotMatch(html, /Retenção/);
  assert.doesNotMatch(html, /Taxa de falha \(update recente\)/);
  assert.doesNotMatch(html, /Usuários únicos 30 dias/);
});

test("período e source status aparecem no HTML", () => {
  const html = renderUtilizacaoApp(mergeUsageSources({ analytics: analyticsOk, expo: expoOk, pharus: pharusOk }));
  assert.match(html, /O filtro de período é aplicado ao Google Analytics/);
  assert.match(html, /usage-source-status/);
  assert.match(html, /page_view/);
  assert.match(html, /data-ui-tooltip/);
  assert.doesNotMatch(html, /Plataforma detectada|Uso da plataforma Web|Google Analytics Web/);
  const order7 = html.indexOf("Usuários ativos · 7 dias");
  const order1 = html.indexOf("Usuários ativos · 1 dia");
  const orderDuration = html.indexOf("Duração média da sessão");
  assert.ok(order7 >= 0 && order7 < order1 && order1 < orderDuration);
});

test("loadUsageSources não deixa Expo lento esconder o GA4", async () => {
  let partial = null;
  const first = await loadUsageSources({
    analyticsTask: async () => analyticsOk,
    expoTask: () => new Promise((resolve) => setTimeout(() => resolve(EXPO_FALLBACK), 50)),
    pharusTask: async () => pharusOk,
    quickWaitMs: 10,
    onPartial: (next) => {
      partial = next;
    },
  });
  assert.equal(first.sources.analytics, "connected");
  assert.equal(first.sources.expo, "loading");
  const html = renderUtilizacaoApp(first);
  assert.match(html, /Usuários ativos · 1 dia/);
  assert.match(html, />19</);
  assert.match(html, /Carregando dados do Expo\/EAS/);
  assert.match(html, /Essa fonte pode levar alguns segundos/);
  assert.doesNotMatch(html, /Não foi possível carregar esta página/);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(partial?.sources.analytics, "connected");
  assert.equal(partial?.sources.expo, "error");
});

test("loadUsageSources: GA4 erro não impede Expo", async () => {
  const page = await loadUsageSources({
    analyticsTask: async () => {
      throw new Error("ga4 down");
    },
    expoTask: async () => expoOk,
    pharusTask: async () => pharusOk,
    quickWaitMs: 50,
  });
  assert.equal(page.sources.analytics, "error");
  assert.equal(page.sources.expo, "connected");
  const html = renderUtilizacaoApp(page);
  assert.match(html, /Não foi possível carregar as métricas de utilização/);
  assert.match(html, /5\. Versões do App/);
  assert.doesNotMatch(html, /Usuários únicos por dia/);
});

test("loadUsageSources: Expo erro chega em onPartial sem apagar GA4", async () => {
  let partial = null;
  const first = await loadUsageSources({
    analyticsTask: async () => analyticsOk,
    expoTask: () => new Promise((_, reject) => setTimeout(() => reject(new Error("expo down")), 40)),
    pharusTask: async () => pharusOk,
    quickWaitMs: 10,
    onPartial: (next) => {
      partial = next;
    },
  });
  assert.equal(first.sources.analytics, "connected");
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.ok(partial);
  assert.equal(partial.sources.analytics, "connected");
  assert.equal(partial.sources.expo, "error");
  const html = renderUtilizacaoApp(partial);
  assert.match(html, />19</);
  assert.match(html, /Não foi possível carregar os dados técnicos do Expo\/EAS/);
});

test("withTimeout devolve fallback sem derrubar a outra fonte", async () => {
  const slow = new Promise((resolve) => setTimeout(() => resolve({ available: true }), 120));
  const value = await withTimeout(slow, 20, { available: false });
  assert.equal(value.available, false);
  await slow;
});

test("tempo de engajamento não usa segundos brutos", () => {
  assert.equal(formatDurationSeconds(780), "13 min");
  assert.equal(formatDurationSeconds(657), "10 min 57 s");
  assert.equal(formatDurationSeconds(128), "2 min 08 s");
});

test("loading Analytics mostra skeleton e não 0", () => {
  const html = renderUtilizacaoApp(mergeUsageSources({
    analytics: ANALYTICS_LOADING,
    expo: expoOk,
    pharus: pharusOk,
  }));
  assert.equal(mergeUsageSources({ analytics: ANALYTICS_LOADING, expo: expoOk, pharus: pharusOk }).sources.analytics, "loading");
  assert.match(html, /ui-skeleton/);
  assert.match(html, /ui-skeleton-chart/);
  assert.doesNotMatch(html, /Não foi possível carregar as métricas de utilização/);
  assert.doesNotMatch(html, />19</);
});

test("loading Expo mantém Analytics visível", () => {
  const page = mergeUsageSources({ analytics: analyticsOk, expo: EXPO_LOADING, pharus: pharusOk });
  assert.equal(page.sources.analytics, "connected");
  assert.equal(page.sources.expo, "loading");
  const html = renderUtilizacaoApp(page);
  assert.match(html, />19</);
  assert.match(html, /Carregando dados do Expo\/EAS/);
  assert.match(html, /Essa fonte pode levar alguns segundos/);
  assert.match(html, /ui-skeleton-table/);
  assert.doesNotMatch(html, /Não foi possível carregar os dados técnicos do Expo\/EAS/);
});

test("zero real não vira skeleton", () => {
  const analyticsZero = {
    ...analyticsOk,
    summary: { ...analyticsOk.summary, active1DayUsers: 0, sessions: 0 },
  };
  const html = renderUtilizacaoApp(mergeUsageSources({ analytics: analyticsZero, expo: expoOk, pharus: pharusOk }));
  assert.match(html, />0</);
  assert.doesNotMatch(html, /ui-skeleton-value/);
  assert.doesNotMatch(html, /Carregando dados do Expo\/EAS/);
});

test("retry Expo não apaga Analytics", async () => {
  const current = mergeUsageSources({ analytics: analyticsOk, expo: EXPO_FALLBACK, pharus: pharusOk });
  const page = await retryUsageSource("expo", {
    current,
    expoTask: async () => expoOk,
  });
  assert.equal(page.sources.analytics, "connected");
  assert.equal(page.sources.expo, "connected");
  assert.match(renderUtilizacaoApp(page), />19</);
  assert.match(renderUtilizacaoApp(page), /1\.2\.1/);
});

test("retry Analytics não apaga Expo", async () => {
  const current = mergeUsageSources({ analytics: ANALYTICS_FALLBACK, expo: expoOk, pharus: pharusOk });
  const page = await retryUsageSource("analytics", {
    current,
    analyticsTask: async () => analyticsOk,
  });
  assert.equal(page.sources.analytics, "connected");
  assert.equal(page.sources.expo, "connected");
});

test("Vercel sem Observe não mostra versões como zero do período", () => {
  const expoServerless = {
    available: true,
    integration: { authenticated: true, projectResolved: true },
    capabilities: {
      channels: true,
      runtimes: true,
      versions: false,
      updateInsights: false,
      channelInsights: false,
      builds: true,
      observe: false,
    },
    versionRows: [],
    channels: [{ name: "production" }, { name: "preview" }, { name: "development" }],
    runtimes: [
      { id: "r1", channel: "production", runtimeVersion: "1.2.1" },
      { id: "r2", channel: "preview", runtimeVersion: "1.2.1" },
    ],
    updates: [{ id: "u1", channel: "production", runtimeVersion: "1.2.1" }],
    builds: [{ id: "b1", platform: "IOS", version: "1.2.1", status: "FINISHED" }],
    channelInsights: [],
    updateInsights: [],
    observe: null,
  };
  const html = renderUtilizacaoApp(mergeUsageSources({ analytics: analyticsOk, expo: expoServerless, pharus: pharusOk }));
  assert.match(html, /Dados de versões aguardando sincronização/);
  assert.match(html, /Dados de saúde e performance aguardando sincronização/);
  assert.doesNotMatch(html, /Métrica não disponível nesta integração/);
  assert.match(html, /Dados de insights detalhados disponíveis apenas no diagnóstico local/);
  assert.match(html, /expo-channel-runtime-table-host/);
  assert.doesNotMatch(html, /expo-channel-insights-table-host/);
  assert.doesNotMatch(html, /expo-update-insights-table-host/);
});
