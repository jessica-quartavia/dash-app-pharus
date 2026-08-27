/**
 * Integração Expo/EAS — server-side only.
 */
import { fetchAllChannelInsights, buildChannelDiagnostics } from "./channel-insights.mjs";
import { formatTelemetryStart, metricToKpi } from "./expo-metric.mjs";
import { listBuilds, listChannels, probeEasAuth } from "./eas-cli.mjs";
import { getConfiguredProjectId, getExpoConfig, getExpoToken } from "./expo-env.mjs";
import { fetchObserveEvents, fetchObserveMetricsSummary, parseObserveMetricsSummary } from "./observe.mjs";

const EXPO_GRAPHQL = "https://api.expo.dev/graphql";
const CACHE_MS = 5 * 60 * 1000;

let cache = { at: 0, payload: null };

async function expoGraphql(query, variables = {}) {
  const token = getExpoToken();
  if (!token) {
    return { ok: false, code: "missing_token", error: "EXPO_ACCESS_TOKEN não configurado no servidor." };
  }

  let response;
  try {
    response = await fetch(EXPO_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    return {
      ok: false,
      code: "network_error",
      error: error instanceof Error ? error.message : "Falha de rede ao consultar Expo.",
    };
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors?.length) {
    return {
      ok: false,
      code: "graphql_error",
      error: body.errors?.[0]?.message || `HTTP ${response.status}`,
    };
  }
  return { ok: true, data: body.data };
}

async function resolveProjectViaGraphql() {
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
    observe: null,
    availability: {
      uniqueUsers: "unavailable",
      usageSeries: "unavailable",
      platformSplit: "unavailable",
      versionAdoption: "unavailable",
      crashes: "unavailable",
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
  if (cache.payload && now - cache.at < CACHE_MS) {
    return { ...cache.payload, cached: true };
  }

  const token = getExpoToken();
  if (!token) {
    const report = emptyReport({
      error: "Token Expo ausente no servidor.",
      userMessage: "Dados de utilização ainda não disponíveis",
    });
    cache = { at: now, payload: report };
    return report;
  }

  try {
    const auth = await probeEasAuth();
    if (!auth.authenticated) {
      const report = emptyReport({
        integration: {
          tokenLoaded: true,
          authenticated: false,
          account: auth.account || getExpoConfig().account,
        },
        error: auth.error || "Token Expo não autenticou no EAS.",
        userMessage: "Integração com Expo em configuração",
      });
      cache = { at: now, payload: report };
      return report;
    }

    const project = await resolveProjectViaGraphql();
    if (!project.resolved) {
      const report = emptyReport({
        integration: {
          tokenLoaded: true,
          authenticated: true,
          account: auth.account,
          role: auth.role,
          projectResolved: false,
        },
        error: project.error,
        userMessage: "Integração com Expo em configuração",
      });
      cache = { at: now, payload: report };
      return report;
    }

    const days = computeInsightsDays(startDate, endDate);
    const buildsResult = listBuilds(project.projectId, 15);
    const channelsResult = listChannels(project.projectId, 25);
    const insightsResult = fetchAllChannelInsights(project.projectId, { days, startDate, endDate });
    const observeResult = fetchObserveMetricsSummary(project.projectId);
    const observeEventsProbe = fetchObserveEvents(project.projectId);

    const builds = buildsResult.ok ? buildsResult.rows : [];
    const channels = channelsResult.ok ? channelsResult.rows : [];
    const observeParsed = observeResult.ok ? parseObserveMetricsSummary(observeResult.data) : null;

    const updates = channels.flatMap((channel) =>
      (channel.branches || []).flatMap((branch) =>
        (branch.runtimeVersions?.length ? branch.runtimeVersions : [branch.runtimeVersion])
          .filter(Boolean)
          .map((runtimeVersion) => ({
            id: `${channel.id}-${branch.id}-${runtimeVersion}`,
            channel: channel.name,
            branch: branch.name,
            runtimeVersion,
            updatedAt: channel.updatedAt,
          })),
      ),
    );

    const primaryInsights = insightsResult.primary;
    const channelDiagnostics = buildChannelDiagnostics(insightsResult.results || []);
    const channelInsights = channelDiagnostics.map((row) => ({
      ...row,
      runtimeVersionShort: String(row.runtimeVersion || "").slice(0, 16),
    }));

    const productionDiag = channelDiagnostics.find((row) => row.channel === "production" && row.responded);

    const usageSeries = primaryInsights?.usageSeries || [];
    const usageSeriesStatus = primaryInsights?.seriesStatus || "unavailable";
    const telemetryStartInsights = primaryInsights?.telemetryStart || null;

    const platformSplit = observeParsed?.platformSplit?.length ? observeParsed.platformSplit : [];
    const versionRows = (observeParsed?.versionRows || []).map((row) => ({
      id: row.id,
      platform: row.platform,
      version: row.version,
      events: row.eventCount,
      percent:
        observeParsed.totalEvents > 0
          ? Math.round((row.eventCount / observeParsed.totalEvents) * 1000) / 10
          : null,
    }));

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

    if (observeParsed?.configured) {
      usageKpis.push({
        key: "observe_events",
        label: "Eventos de performance",
        status: "ok",
        kind: "number",
        value: observeParsed.totalEvents,
        note: observeParsed.periodNote,
      });
    }

    const availability = {
      uniqueUsers: primaryInsights?.embeddedUniqueUsers?.status === "available" ? "ok" : "unavailable",
      otaUniqueUsers: primaryInsights?.otaUniqueUsers?.status === "available" ? "ok" : "unavailable",
      usageSeries: usageSeriesStatus === "available" && usageSeries.length ? "ok" : usageSeriesStatus === "no_history" ? "no_history" : "unavailable",
      platformSplit: platformSplit.length ? "ok" : observeParsed?.configured ? "ok" : "unavailable",
      versionAdoption: versionRows.length ? "ok" : "unavailable",
      crashes: primaryInsights?.failedInstalls?.status === "available" ? "ok" : "unavailable",
      channelInsights: insightsResult.worked ? "ok" : "unavailable",
      observe: observeParsed?.configured ? "ok" : "unavailable",
    };

    const report = {
      available: Boolean(
        insightsResult.worked || builds.length || channels.length || observeParsed?.configured,
      ),
      integration: {
        tokenLoaded: true,
        authenticated: true,
        account: auth.account,
        role: auth.role,
        actor: auth.actor,
        projectResolved: true,
        projectId: project.projectId,
        projectName: project.name,
        projectSlug: project.slug,
        fullName: project.fullName,
        resolveMethod: project.method,
        channelsCount: channels.length,
        buildsCount: builds.length,
      },
      diagnostics: {
        channelInsightsWorks: Boolean(insightsResult.worked),
        observeConfigured: Boolean(observeParsed?.configured),
        observeEventsAvailable: observeEventsProbe.ok,
        observeEventsRequiresBilling: /subscription|billing/i.test(String(observeEventsProbe.error || "")),
        observeRespectsDateRange: false,
        expoInsightsInMobileRepo: null,
        channelRuntimePairs: insightsResult.pairs || [],
        channelDiagnostics,
        productionChannel: productionDiag?.channel || insightsResult.primaryChannel || null,
        telemetryStartInsights: formatTelemetryStart(telemetryStartInsights),
        insightsTimespan: primaryInsights?.timespan || null,
      },
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
        days,
        insightsTimespan: primaryInsights?.timespan || null,
        observeRespectsDateRange: false,
      },
      usageKpis,
      summary: usageKpis,
      usageSeries,
      usageSeriesStatus,
      telemetryStartInsights: formatTelemetryStart(telemetryStartInsights),
      platformSplit,
      platformSplitSource: platformSplit.length ? "eas_observe" : null,
      versionRows,
      versionRowsSource: versionRows.length ? "eas_observe" : null,
      updates,
      builds,
      channels,
      channelInsights,
      observe: observeParsed,
      availability,
      error: null,
      userMessage: null,
    };

    cache = { at: now, payload: report };
    return report;
  } catch (error) {
    const report = emptyReport({
      integration: { tokenLoaded: true },
      error: error instanceof Error ? error.message : "Erro inesperado na integração Expo.",
      userMessage: "Integração com Expo em configuração",
    });
    cache = { at: now, payload: report };
    return report;
  }
}

export { probeEasAuth, listBuilds, listChannels } from "./eas-cli.mjs";
