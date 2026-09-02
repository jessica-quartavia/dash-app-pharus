/**
 * Integração Expo/EAS — server-side only.
 * /api/expo/usage não executa scripts/collect-expo-observe.mjs.
 * Observe live depende de EAS CLI; na Vercel a leitura futura é persistida.
 */
import { fetchAllChannelInsights, buildChannelDiagnostics } from "./channel-insights.mjs";
import { formatTelemetryStart, metricToKpi } from "./expo-metric.mjs";
import { easCliAllowed, listBuilds, listChannels } from "./eas-cli.mjs";
import { getConfiguredProjectId, getExpoConfig, getExpoToken } from "./expo-env.mjs";
import { expoGraphql, settledValue } from "./expo-graphql.mjs";
import {
  deriveRuntimes,
  fetchGraphqlBuilds,
  fetchGraphqlChannels,
  fetchGraphqlDeployments,
  fetchGraphqlUpdates,
} from "./graphql-catalog.mjs";
import { fetchObserveEvents, fetchObserveMetricsSummary, parseObserveMetricsSummary } from "./observe.mjs";
import { overlayPersistedInsights, readPersistedInsights } from "./persisted-insights.mjs";
import { fetchRecentUpdateInsights } from "./update-insights.mjs";

const CACHE_MS = 5 * 60 * 1000;

let cache = { at: 0, key: "", payload: null };

function logExpo(event, extra) {
  if (process.env.NODE_TEST_CONTEXT) return;
  if (extra === undefined) console.info("[expo]", event);
  else console.info("[expo]", event, extra);
}

const UNAVAILABLE_METRIC = { status: "unavailable", value: null };

function headlineKpis(updateInsights = {}) {
  const crashScope = updateInsights.latestCrashRateScope;
  return [
    metricToKpi({ key: "unique_users_7d", label: "Usuários únicos 7 dias", metric: UNAVAILABLE_METRIC, note: "O Expo não retornou um total deduplicado de usuários do aplicativo para 7 dias." }),
    metricToKpi({ key: "unique_users_30d", label: "Usuários únicos 30 dias", metric: UNAVAILABLE_METRIC, note: "O Expo retorna usuários de updates por channel/runtime, não um total deduplicado do aplicativo." }),
    metricToKpi({ key: "launches", label: "Launches de updates recentes", metric: updateInsights.launches || UNAVAILABLE_METRIC, note: "Soma dos launchAssetCount explicitamente retornados para até cinco grupos de update recentes no período." }),
    metricToKpi({ key: "crash_rate", label: "Taxa de falha (update recente)", metric: updateInsights.latestCrashRate || UNAVAILABLE_METRIC, kind: "percent", note: crashScope ? `Taxa explícita do grupo ${crashScope.groupId.slice(0, 8)}… em ${String(crashScope.platform || "plataforma não informada").toUpperCase()}; não é uma taxa global do aplicativo.` : "Crash rate não foi retornado pelo Expo/EAS atual." }),
  ];
}

async function listAppBuilds(projectId, limit = 15) {
  const gql = await fetchGraphqlBuilds(projectId, limit);
  if (gql.ok) return gql;
  if (easCliAllowed()) return listBuilds(projectId, limit);
  return gql;
}

async function listAppChannels(projectId, limit = 25) {
  const gql = await fetchGraphqlChannels(projectId, limit);
  if (gql.ok) return gql;
  if (easCliAllowed()) return listChannels(projectId, limit);
  return gql;
}

export async function resolveExpoProject() {
  const config = getExpoConfig();
  const configuredId = getConfiguredProjectId();
  if (configuredId) {
    return {
      resolved: true,
      projectId: configuredId,
      name: "Pharus",
      slug: config.slug,
      fullName: config.fullName,
      method: "env:EXPO_PROJECT_ID",
    };
  }

  const accountQuery = `query AccountApps($name: String!) {
    account {
      byName(accountName: $name) {
        id
        name
        apps(limit: 50, offset: 0) {
          id
          name
          slug
          fullName
        }
      }
    }
  }`;

  const accountResult = await expoGraphql(accountQuery, { name: config.account });
  if (!accountResult.ok) {
    return {
      resolved: false,
      error: accountResult.error,
      code: accountResult.code,
      reason: "account_lookup_failed",
    };
  }

  const apps = accountResult.data?.account?.byName?.apps || [];
  const match = apps.find((app) => String(app.slug) === config.slug);
  if (match?.id) {
    return {
      resolved: true,
      projectId: match.id,
      name: match.name || null,
      slug: match.slug || config.slug,
      fullName: match.fullName || config.fullName,
      method: "graphql:account.byName",
    };
  }

  const appQuery = `query AppByFullName($fullName: String!) {
    app {
      byFullName(fullName: $fullName) {
        id
        name
        slug
        fullName
      }
    }
  }`;
  const appResult = await expoGraphql(appQuery, { fullName: config.fullName });
  if (!appResult.ok) {
    return {
      resolved: false,
      error: appResult.error,
      code: appResult.code,
      reason: "app_lookup_failed",
    };
  }

  const app = appResult.data?.app?.byFullName;
  if (!app?.id) {
    return {
      resolved: false,
      error: `Projeto ${config.fullName} não encontrado na conta ${config.account}.`,
      code: "project_not_found",
      reason: "project_not_in_account",
    };
  }

  return {
    resolved: true,
    projectId: app.id,
    name: app.name,
    slug: app.slug,
    fullName: app.fullName,
    method: "graphql:app.byFullName",
  };
}

function emptyReport(base = {}) {
  return {
    available: false,
    integration: {
      authenticated: false,
      account: null,
      role: null,
      projectResolved: false,
      projectId: null,
      projectSlug: getExpoConfig().slug,
      fullName: getExpoConfig().fullName,
      tokenLoaded: Boolean(getExpoToken()),
      ...base.integration,
    },
    diagnostics: {
      channelInsightsWorks: false,
      observeConfigured: false,
      observeEventsAvailable: false,
      expoInsightsInMobileRepo: null,
      ...base.diagnostics,
    },
    period: base.period || { startDate: null, endDate: null },
    usageKpis: [],
    headlineKpis: headlineKpis(),
    summary: [],
    usageSeries: [],
    platformSplit: [],
    platformSplitSource: null,
    versionRows: [],
    versionRowsSource: null,
    updates: [],
    builds: [],
    channels: [],
    channelInsights: [],
    updateInsights: [],
    observe: null,
    capabilities: {
      channels: false,
      runtimes: false,
      versions: false,
      updateInsights: false,
      channelInsights: false,
      builds: false,
      observe: false,
    },
    runtimes: [],
    availability: {
      uniqueUsers: "unavailable",
      usageSeries: "unavailable",
      platformSplit: "unavailable",
      versionAdoption: "unavailable",
      crashes: "unavailable",
      launches: "unavailable",
      crashRate: "unavailable",
      channelInsights: "unavailable",
      observe: "unavailable",
    },
    error: base.error || null,
    userMessage: base.userMessage || "Integração com Expo em configuração",
  };
}

function computeInsightsDays(startDate, endDate) {
  if (!startDate || !endDate) return 30;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 30;
  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return Math.min(Math.max(diff, 1), 90);
}

export async function buildExpoUsageReport({ startDate, endDate } = {}) {
  const now = Date.now();
  const cacheKey = `${startDate || "all"}:${endDate || "all"}`;
  if (cache.payload?.available && cache.key === cacheKey && now - cache.at < CACHE_MS) {
    return { ...cache.payload, cached: true };
  }

  const token = getExpoToken();
  logExpo("token loaded", { loaded: Boolean(token) });
  if (!token) {
    const report = emptyReport({
      error: "Token Expo ausente no servidor.",
      userMessage: "Dados de utilização ainda não disponíveis",
    });
    return report;
  }

  try {
    const project = await resolveExpoProject();
    logExpo("project resolved", { resolved: Boolean(project.resolved), method: project.method || null });
    if (!project.resolved) {
      const report = emptyReport({
        integration: {
          tokenLoaded: true,
          authenticated: project.code !== "missing_token" && project.code !== "network_error",
          account: getExpoConfig().account,
          projectResolved: false,
        },
        error: project.error,
        userMessage: "Integração com Expo em configuração",
      });
      logExpo("query error", { reason: "project" });
      return report;
    }

    const days = computeInsightsDays(startDate, endDate);
    const cli = easCliAllowed();
    const insightsFallback = { ok: false, worked: false, results: [], pairs: [], primary: null };
    const updateInsightsFallback = {
      ok: false,
      rows: [],
      launches: UNAVAILABLE_METRIC,
      latestCrashRate: UNAVAILABLE_METRIC,
    };
    const settled = await Promise.allSettled([
      listAppBuilds(project.projectId, 15),
      listAppChannels(project.projectId, 25),
      fetchGraphqlDeployments(project.projectId, 25),
      fetchGraphqlUpdates(project.projectId, 25),
      cli ? fetchAllChannelInsights(project.projectId, { days, startDate, endDate }) : Promise.resolve(insightsFallback),
      cli ? fetchObserveMetricsSummary(project.projectId) : Promise.resolve({ ok: false }),
      cli ? fetchObserveEvents(project.projectId) : Promise.resolve({ ok: false }),
      cli ? fetchRecentUpdateInsights(project.projectId, { days, startDate, endDate, limit: 5 }) : Promise.resolve(updateInsightsFallback),
    ]);

    const buildsResult = settledValue(settled[0], { ok: false, rows: [] });
    const channelsResult = settledValue(settled[1], { ok: false, rows: [] });
    const deploymentsResult = settledValue(settled[2], { ok: false, rows: [] });
    const graphqlUpdatesResult = settledValue(settled[3], { ok: false, rows: [] });
    const insightsResult = settledValue(settled[4], insightsFallback);
    const observeResult = settledValue(settled[5], { ok: false });
    const observeEventsProbe = settledValue(settled[6], { ok: false });
    const updateInsightsResult = settledValue(settled[7], updateInsightsFallback);

    const builds = buildsResult.ok ? buildsResult.rows : [];
    const channels = channelsResult.ok ? channelsResult.rows : [];
    const deployments = deploymentsResult.ok ? deploymentsResult.rows : [];
    const graphqlUpdates = graphqlUpdatesResult.ok ? graphqlUpdatesResult.rows : [];
    const observeParsed = observeResult.ok ? parseObserveMetricsSummary(observeResult.data) : null;

    const runtimes = deriveRuntimes({ channels, deployments, updates: graphqlUpdates });
    const updates = runtimes.filter((row) => row.runtimeVersion || row.channel);

    const primaryInsights = insightsResult.primary;
    const channelDiagnostics = insightsResult.worked
      ? buildChannelDiagnostics(insightsResult.results || [])
      : runtimes.map((row) => ({
          channel: row.channel,
          runtimeVersion: row.runtimeVersion,
          source: "graphql",
          responded: false,
          embeddedUsers: null,
          otaUsers: null,
          failures: null,
        }));
    const channelInsights = insightsResult.worked
      ? channelDiagnostics.map((row) => ({
          ...row,
          runtimeVersionShort: String(row.runtimeVersion || "").slice(0, 16),
        }))
      : [];

    const productionDiag = channelDiagnostics.find((row) => row.channel === "production" && row.responded);

    const usageSeries = primaryInsights?.usageSeries || [];
    const usageSeriesStatus = primaryInsights?.seriesStatus || "unavailable";
    const telemetryStartInsights = primaryInsights?.telemetryStart || null;

    const persisted = await readPersistedInsights();
    const liveVersionRows = (observeParsed?.versionRows || []).map((row) => ({
      id: row.id,
      platform: row.platform,
      version: row.version,
      events: row.eventCount,
      percent:
        observeParsed.totalEvents > 0
          ? Math.round((row.eventCount / observeParsed.totalEvents) * 1000) / 10
          : null,
    }));
    const overlaid = overlayPersistedInsights({
      versionRows: liveVersionRows,
      observe: observeParsed,
      capabilities: {
        channels: Boolean(channelsResult.ok),
        runtimes: Boolean((deploymentsResult.ok && deployments.length > 0) || runtimes.some((row) => row.runtimeVersion) || channels.length > 0),
        versions: Boolean(cli && observeParsed?.configured),
        updateInsights: Boolean(cli && updateInsightsResult.ok),
        channelInsights: Boolean(cli && insightsResult.worked),
        builds: Boolean(buildsResult.ok),
        observe: Boolean(cli && observeParsed?.configured),
        availableInServerless: {
          channels: true,
          runtimes: true,
          builds: true,
          versions: false,
          updateInsights: false,
          channelInsights: false,
          observe: false,
        },
      },
      persisted,
    });
    const versionRows = overlaid.versionRows;
    const observe = overlaid.observe;
    const platformSplit = observe?.platformSplit?.length ? observe.platformSplit : [];

    const usageKpis = [];
    if (insightsResult.worked && primaryInsights) {
      usageKpis.push(
        metricToKpi({
          key: "embedded_unique_users",
          label: "Usuários únicos (update embarcado)",
          metric: primaryInsights.embeddedUniqueUsers,
          note: `Canal ${insightsResult.primaryChannel || "production"} · runtime EAS Update. Telemetria agregada anônima; não equivale à base de clientes Supabase.`,
        }),
        metricToKpi({
          key: "ota_unique_users",
          label: "Usuários únicos (OTA)",
          metric: primaryInsights.otaUniqueUsers,
          note: "Campo otaTotalUniqueUsers retornado explicitamente pelo EAS channel:insights.",
        }),
      );
      if (primaryInsights.failedInstalls?.status === "available") {
        usageKpis.push(
          metricToKpi({
            key: "failed_installs",
            label: "Instalações com falha",
            metric: primaryInsights.failedInstalls,
            note: "Fonte: EAS channel:insights (embedded_update_failed_installs).",
          }),
        );
      }
    }

    if (observe?.configured) {
      usageKpis.push({
        key: "observe_events",
        label: "Eventos de performance",
        status: "ok",
        kind: "number",
        value: observe.totalEvents,
        note: observe.periodNote,
      });
    }

    const capabilities = overlaid.capabilities;

    const availability = {
      uniqueUsers: primaryInsights?.embeddedUniqueUsers?.status === "available" ? "ok" : "unavailable",
      otaUniqueUsers: primaryInsights?.otaUniqueUsers?.status === "available" ? "ok" : "unavailable",
      usageSeries: usageSeriesStatus === "available" && usageSeries.length ? "ok" : usageSeriesStatus === "no_history" ? "no_history" : "unavailable",
      platformSplit: platformSplit.length ? "ok" : observe?.configured ? "ok" : "unavailable",
      versionAdoption: capabilities.versions ? (versionRows.length ? "ok" : "empty") : "unavailable",
      crashes: primaryInsights?.failedInstalls?.status === "available" ? "ok" : "unavailable",
      launches: updateInsightsResult.launches?.status === "available" ? "ok" : "unavailable",
      crashRate: updateInsightsResult.latestCrashRate?.status === "available" ? "ok" : "unavailable",
      channelInsights: capabilities.channelInsights ? "ok" : "unavailable",
      observe: capabilities.observe ? "ok" : "unavailable",
    };

    const report = {
      available: true,
      ok: true,
      capabilities,
      integration: {
        tokenLoaded: true,
        authenticated: true,
        account: getExpoConfig().account,
        role: null,
        actor: null,
        projectResolved: true,
        projectId: project.projectId,
        projectName: project.name,
        projectSlug: project.slug,
        fullName: project.fullName,
        resolveMethod: project.method,
        channelsCount: channels.length,
        buildsCount: builds.length,
        runtimesCount: runtimes.length,
      },
      diagnostics: {
        channelInsightsWorks: Boolean(insightsResult.worked),
        observeConfigured: Boolean(observe?.configured),
        observeLive: Boolean(observeParsed?.configured),
        observeEventsAvailable: observeEventsProbe.ok,
        observeEventsRequiresBilling: /subscription|billing/i.test(String(observeEventsProbe.error || "")),
        observeRespectsDateRange: false,
        persistedInsights: {
          status: persisted.versions?.status || persisted.performance?.status || "not_connected",
          versions: Boolean(persisted.versions?.available),
          performance: Boolean(persisted.performance?.available),
        },
        expoInsightsInMobileRepo: null,
        channelRuntimePairs: insightsResult.pairs || runtimes,
        channelDiagnostics,
        productionChannel: productionDiag?.channel || insightsResult.primaryChannel || channels.find((row) => row.name === "production")?.name || null,
        telemetryStartInsights: formatTelemetryStart(telemetryStartInsights),
        insightsTimespan: primaryInsights?.timespan || null,
        graphql: {
          builds: Boolean(buildsResult.ok),
          channels: Boolean(channelsResult.ok),
          deployments: Boolean(deploymentsResult.ok),
          updates: Boolean(graphqlUpdatesResult.ok),
        },
      },
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
        days,
        insightsTimespan: primaryInsights?.timespan || null,
        observeRespectsDateRange: false,
      },
      usageKpis,
      headlineKpis: headlineKpis(updateInsightsResult),
      summary: usageKpis,
      usageSeries,
      usageSeriesStatus,
      telemetryStartInsights: formatTelemetryStart(telemetryStartInsights),
      platformSplit,
      platformSplitSource: platformSplit.length ? overlaid.observeSource || overlaid.versionRowsSource : null,
      versionRows,
      versionRowsSource: versionRows.length ? overlaid.versionRowsSource : null,
      runtimes,
      updates,
      builds,
      channels,
      channelInsights,
      updateInsights: capabilities.updateInsights ? updateInsightsResult.rows || [] : [],
      observe,
      availability,
      error: null,
      userMessage: null,
    };

    logExpo("token loaded=true");
    logExpo("project resolved=true");
    logExpo("query ok", {
      channels: channels.length,
      runtimes: runtimes.length,
      versionsCapability: capabilities.versions,
      updatesCapability: capabilities.updateInsights,
      builds: builds.length,
      cli,
    });
    cache = { at: now, key: cacheKey, payload: report };
    return report;
  } catch (error) {
    logExpo("query error", { ok: false });
    const report = emptyReport({
      integration: { tokenLoaded: true },
      error: error instanceof Error ? error.message : "Erro inesperado na integração Expo.",
      userMessage: "Integração com Expo em configuração",
    });
    return report;
  }
}

export { probeEasAuth, listBuilds, listChannels } from "./eas-cli.mjs";
