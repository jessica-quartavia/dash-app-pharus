import { bindUsageLineChartTooltips } from "../components/charts.mjs";
import { bindExpandableChartLists } from "../components/expandable-chart-list.mjs";
import { bindFloatingTooltips } from "../components/floating-tooltip.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getAppUsagePage, mergeUsageSources, retryAppUsageSource } from "../services/app-pharus/app-usage.mjs";
import { ANALYTICS_LOADING, EXPO_LOADING, PHARUS_LOADING } from "../services/app-pharus/usage-sources.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatDecimal, formatNumber, formatPercent } from "../utils/format.mjs";
import { renderUtilizacaoApp } from "./utilizacao-app-view.mjs";

export { renderUtilizacaoApp };

let lastUsagePage = null;
let lastUsageFilters = {};
let retrying = false;

const channelInsightsTable = mountInteractiveTable("expo-channel-insights-table-host", {
  defaultState: { sortKey: "embeddedUsers", sortDir: "desc" }, rowIdKey: "id",
  title: (rows) => `${formatNumber(rows.length)} combinações de channel e runtime`,
  columns: [
    { key: "channel", label: "Channel", sortable: true, value: (row) => escapeHtml(row.channel || "—") },
    { key: "runtimeVersion", label: "Runtime", sortable: true, value: (row) => `<code>${escapeHtml(String(row.runtimeVersion || "—").slice(0, 16))}</code>` },
    { key: "embeddedUsers", label: "Embedded", sortable: true, numeric: true, value: (row) => row.embeddedUsers == null ? "—" : formatNumber(row.embeddedUsers) },
    { key: "otaUsers", label: "OTA", sortable: true, numeric: true, value: (row) => row.otaUsers == null ? "—" : formatNumber(row.otaUsers) },
  ], onRowClick: () => {},
});

const updateInsightsTable = mountInteractiveTable("expo-update-insights-table-host", {
  defaultState: { sortKey: "launchesValue", sortDir: "desc" }, rowIdKey: "id",
  title: (rows) => `${formatNumber(rows.length)} recortes de updates recentes`,
  columns: [
    { key: "branch", label: "Branch", sortable: true, value: (row) => escapeHtml(row.branch || "—") },
    { key: "platform", label: "Plataforma", sortable: true, value: (row) => escapeHtml(String(row.platform || "—").toUpperCase()) },
    { key: "uniqueUsersValue", label: "Usuários únicos", sortable: true, numeric: true, value: (row) => row.uniqueUsersValue == null ? "—" : formatNumber(row.uniqueUsersValue) },
    { key: "launchesValue", label: "Launches", sortable: true, numeric: true, value: (row) => row.launchesValue == null ? "—" : formatNumber(row.launchesValue) },
    { key: "crashRateValue", label: "Taxa de falha", sortable: true, numeric: true, value: (row) => row.crashRateValue == null ? "—" : formatPercent(row.crashRateValue) },
  ], onRowClick: () => {},
});

const performanceTable = mountInteractiveTable("expo-performance-table-host", {
  defaultState: { sortKey: "eventCount", sortDir: "desc" }, rowIdKey: "id",
  title: (rows) => `${formatNumber(rows.length)} medições por versão e plataforma`,
  columns: [
    { key: "metricLabel", label: "Métrica", sortable: true, value: (row) => escapeHtml(row.metricLabel || row.metricName || "—") },
    { key: "platform", label: "Plataforma", sortable: true, value: (row) => escapeHtml(row.platform || "—") },
    { key: "version", label: "Versão", sortable: true, value: (row) => escapeHtml(row.version || "—") },
    { key: "eventCount", label: "Eventos", sortable: true, numeric: true, value: (row) => row.eventCount == null ? "—" : formatNumber(row.eventCount) },
    { key: "medianSeconds", label: "Mediana", sortable: true, numeric: true, value: (row) => row.medianSeconds == null ? "—" : `${formatDecimal(row.medianSeconds, { digits: 3 })} s` },
    { key: "p90Seconds", label: "P90", sortable: true, numeric: true, value: (row) => row.p90Seconds == null ? "—" : `${formatDecimal(row.p90Seconds, { digits: 3 })} s` },
  ], onRowClick: () => {},
});

const buildsTable = mountInteractiveTable("expo-builds-table-host", {
  defaultState: { sortKey: "createdAt", sortDir: "desc" }, rowIdKey: "id",
  title: (rows) => `${formatNumber(rows.length)} builds recentes`,
  columns: [
    { key: "platform", label: "Plataforma", sortable: true, value: (row) => escapeHtml(row.platform || "—") },
    { key: "version", label: "Versão", sortable: true, value: (row) => escapeHtml(row.version || "—") },
    { key: "status", label: "Status", sortable: true, value: (row) => escapeHtml(row.status || "—") },
    { key: "createdAt", label: "Criado em", sortable: true, value: (row) => formatDate(row.createdAt) },
  ], onRowClick: () => {},
});

const updatesTable = mountInteractiveTable("expo-updates-table-host", {
  defaultState: { sortKey: "updatedAt", sortDir: "desc" }, rowIdKey: "id",
  title: (rows) => `${formatNumber(rows.length)} runtimes publicados`,
  columns: [
    { key: "channel", label: "Canal", sortable: true, value: (row) => escapeHtml(row.channel || "—") },
    { key: "branch", label: "Branch", sortable: true, value: (row) => escapeHtml(row.branch || "—") },
    { key: "runtimeVersion", label: "Runtime version", sortable: true, value: (row) => `<code>${escapeHtml(String(row.runtimeVersion || "—").slice(0, 20))}</code>` },
    { key: "updatedAt", label: "Atualizado em", sortable: true, value: (row) => formatDate(row.updatedAt) },
  ], onRowClick: () => {},
});

export function bindUtilizacaoApp(data) {
  lastUsagePage = data;
  const expo = data.expo || {};
  if (!expo.loading && expo.available) {
    channelInsightsTable.mount({ rows: (expo.channelInsights || []).map((row, index) => ({ ...row, id: `${row.channel}-${row.runtimeVersion}-${index}` })) });
    updateInsightsTable.mount({ rows: (expo.updateInsights || []).map((row) => ({
      ...row,
      uniqueUsersValue: row.uniqueUsers?.status === "available" ? row.uniqueUsers.value : null,
      launchesValue: row.launches?.status === "available" ? row.launches.value : null,
      crashRateValue: row.crashRate?.status === "available" ? row.crashRate.value : null,
    })) });
    performanceTable.mount({ rows: expo.observe?.performanceRows || [] });
    buildsTable.mount({ rows: expo.builds || [] });
    updatesTable.mount({ rows: expo.updates || [] });
  }
  const root = document.getElementById("page-content") || document;
  bindUsageLineChartTooltips(root);
  bindFloatingTooltips(root);
  bindExpandableChartLists(root);
  bindSourceRetry(root);
}

function paintUsagePage(data) {
  const contentEl = document.getElementById("page-content");
  if (!contentEl) return;
  lastUsagePage = data;
  contentEl.innerHTML = renderUtilizacaoApp(data);
  contentEl.dataset.pageId = "utilizacao_app";
  bindUtilizacaoApp(data);
}

function bindSourceRetry(root) {
  root.querySelectorAll("[data-retry-source]").forEach((button) => {
    button.addEventListener("click", () => {
      void retrySource(button.dataset.retrySource);
    });
  });
}

async function retrySource(source) {
  if (!source || retrying) return;
  retrying = true;
  const current = lastUsagePage || {};
  const loadingPage = mergeUsageSources({
    analytics: source === "analytics" ? ANALYTICS_LOADING : current.analytics,
    expo: source === "expo" ? EXPO_LOADING : current.expo,
    pharus: source === "pharus" ? PHARUS_LOADING : current.pharus,
  });
  paintUsagePage(loadingPage);
  try {
    const next = await retryAppUsageSource(source, lastUsageFilters, current);
    paintUsagePage(next);
  } finally {
    retrying = false;
  }
}

export function bootUtilizacaoApp() {
  mountPage({
    pageId: "utilizacao_app",
    filterNote: "O período vale para o Google Analytics. Nas seções técnicas, o Expo/EAS usa o recorte quando a fonte aceita.",
    preserveContentOnReload: true,
    load: (filters, options) => {
      lastUsageFilters = filters;
      return getAppUsagePage(filters, {
        ...options,
        previous: lastUsagePage,
        onPartial: paintUsagePage,
      });
    },
    render: (data) => {
      lastUsagePage = data;
      queueMicrotask(() => bindUtilizacaoApp(data));
      return renderUtilizacaoApp(data);
    },
  });
}
