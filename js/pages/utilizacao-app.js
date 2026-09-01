import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { bindUsageLineChartTooltips, hBars, usageLineChart } from "../components/charts.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { appUsageConstructionNotice, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getAppUsagePage } from "../services/app-pharus/app-usage.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatDecimal, formatNumber, formatPercent } from "../utils/format.mjs";

const UNAVAILABLE = "Não disponível pela integração atual do Expo";

function emptyState() {
  return `<div class="app-usage-empty" role="status"><span aria-hidden="true">—</span><strong>Dados ainda não disponíveis</strong><small>Essa métrica não é retornada pela integração atual.</small></div>`;
}

function expoStatus(expo) {
  if (expo.available && expo.integration?.projectResolved) {
    return "";
  }
  return `<div class="gd-status" role="status"><strong>Integração Expo temporariamente indisponível</strong><span>${escapeHtml(expo.userMessage || "Os dados da base Pharus continuam disponíveis.")}</span></div>`;
}

function renderKpis(rows, variant = "kpi-row-primary") {
  if (!rows?.length) return `<p class="placeholder-note">${UNAVAILABLE}</p>`;
  const shortDescriptions = {
    embedded_unique_users: "Update embarcado",
    ota_unique_users: "Atualizações OTA",
    failed_installs: "Falhas de instalação",
    performance_events: "Resumo do Observe",
    cold_launch_measurements: "Medições técnicas",
  };
  return kpiRow(rows.map((item) => kpiCard(
    item.label,
    formatKpiValue(item),
    shortDescriptions[item.key] || "Expo / EAS",
    { featured: true, tooltip: item.note },
  )), variant);
}

function headlineKpis(expo) {
  const fallback = [
    ["unique_users_7d", "Usuários únicos 7 dias", "O Expo não retornou um total deduplicado para este período."],
    ["unique_users_30d", "Usuários únicos 30 dias", "O Expo retorna usuários de updates, não um total deduplicado do app."],
    ["launches", "Launches", "Launches não foram retornados pelo EAS Insights atual."],
    ["crash_rate", "Taxa de falha", "Crash rate não foi retornado pelo Expo/EAS atual."],
  ].map(([key, label, note]) => ({ key, label, status: "unavailable", value: "Não disponível", note }));
  const rows = expo.headlineKpis?.length ? expo.headlineKpis : fallback;
  const displayLabels = {
    unique_users_7d: "Usuários únicos · 7 dias",
    unique_users_30d: "Usuários únicos · 30 dias",
    launches: "Launches",
    crash_rate: "Taxa de falha",
  };
  const descriptions = {
    unique_users_7d: "Sem total consolidado pelo Expo",
    unique_users_30d: "Sem total consolidado pelo Expo",
    launches: "Updates recentes",
    crash_rate: "Update recente",
  };
  return `<div class="app-usage-kpi-grid">${rows.map((item) => {
    const unavailable = item.status === "unavailable";
    const value = unavailable ? "—" : formatKpiValue(item);
    const description = unavailable ? "Não disponível" : descriptions[item.key] || "Expo / EAS";
    const helper = descriptions[item.key] || "Expo / EAS";
    return `<article class="app-usage-kpi${unavailable ? " is-unavailable" : ""}">
      <div class="app-usage-kpi-head">
        <span>${escapeHtml(displayLabels[item.key] || item.label)}</span>
        <span class="app-usage-info" tabindex="0" role="img" aria-label="${escapeHtml(item.note || helper)}" title="${escapeHtml(item.note || helper)}">i</span>
      </div>
      <div class="app-usage-kpi-value">${value}</div>
      <div class="app-usage-kpi-description">${escapeHtml(description)}</div>
      ${unavailable ? `<div class="app-usage-kpi-context">${escapeHtml(helper)}</div>` : ""}
    </article>`;
  }).join("")}</div>`;
}

function updateKpis(expo) {
  const keys = new Set(["embedded_unique_users", "ota_unique_users", "failed_installs"]);
  return renderKpis((expo.usageKpis || []).filter((item) => keys.has(item.key)), "kpi-row-secondary kpi-row-3");
}

function contextKpis(context) {
  if (!context.available) return `<p class="placeholder-note">Contexto da base Pharus indisponível.</p>`;
  return kpiRow((context.kpis || []).map((item) => kpiCard(item.label, formatNumber(item.value), "", { compact: true })), "kpi-row-secondary");
}

const channelInsightsTable = mountInteractiveTable("expo-channel-insights-table-host", {
  defaultState: { sortKey: "embeddedUsers", sortDir: "desc" }, rowIdKey: "id",
  title: (rows) => `${formatNumber(rows.length)} combinações de channel e runtime`,
  columns: [
    { key: "channel", label: "Channel", sortable: true, value: (row) => escapeHtml(row.channel || "—") },
    { key: "runtimeVersion", label: "Runtime", sortable: true, value: (row) => `<code>${escapeHtml(String(row.runtimeVersion || "—").slice(0, 16))}</code>` },
    { key: "embeddedUsers", label: "Embedded", sortable: true, numeric: true, value: (row) => row.embeddedUsers == null ? "Não disponível" : formatNumber(row.embeddedUsers) },
    { key: "otaUsers", label: "OTA", sortable: true, numeric: true, value: (row) => row.otaUsers == null ? "Não disponível" : formatNumber(row.otaUsers) },
  ], onRowClick: () => {},
});

const updateInsightsTable = mountInteractiveTable("expo-update-insights-table-host", {
  defaultState: { sortKey: "launchesValue", sortDir: "desc" }, rowIdKey: "id",
  title: (rows) => `${formatNumber(rows.length)} recortes de updates recentes`,
  columns: [
    { key: "branch", label: "Branch", sortable: true, value: (row) => escapeHtml(row.branch || "—") },
    { key: "platform", label: "Plataforma", sortable: true, value: (row) => escapeHtml(String(row.platform || "—").toUpperCase()) },
    { key: "uniqueUsersValue", label: "Usuários únicos", sortable: true, numeric: true, value: (row) => row.uniqueUsersValue == null ? "Não disponível" : formatNumber(row.uniqueUsersValue) },
    { key: "launchesValue", label: "Launches", sortable: true, numeric: true, value: (row) => row.launchesValue == null ? "Não disponível" : formatNumber(row.launchesValue) },
    { key: "crashRateValue", label: "Taxa de falha", sortable: true, numeric: true, value: (row) => row.crashRateValue == null ? "Não disponível" : formatPercent(row.crashRateValue) },
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

export function bootUtilizacaoApp() {
  mountPage({
    pageId: "utilizacao_app",
    filterNote: "",
    load: getAppUsagePage,
    render: ({ expo, context }) => {
      queueMicrotask(() => {
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
        bindUsageLineChartTooltips(document.getElementById("page-content") || document);
      });
      const seriesAvailable = expo.usageSeriesStatus === "available" && expo.usageSeries?.length;
      const platformAvailable = expo.availability?.platformSplit === "ok" && expo.platformSplit?.length;
      const versionAvailable = expo.versionRows?.length;
      const primaryChannel = (expo.channelInsights || []).find((row) => row.channel === "production" && row.responded)
        || (expo.channelInsights || []).find((row) => row.responded);
      const updateTotal = (primaryChannel?.embeddedUsers || 0) + (primaryChannel?.otaUsers || 0);
      const updateComposition = primaryChannel ? [
        { label: "Embedded", count: primaryChannel.embeddedUsers, percent: updateTotal ? (primaryChannel.embeddedUsers / updateTotal) * 100 : 0 },
        { label: "OTA", count: primaryChannel.otaUsers, percent: updateTotal ? (primaryChannel.otaUsers / updateTotal) * 100 : 0 },
      ].filter((row) => row.count != null) : [];
      const observeAvailable = expo.observe?.configured;
      const coldLaunchMeasurements = (expo.observe?.performanceRows || [])
        .filter((row) => row.metricName === "expo.app_startup.cold_launch_time")
        .reduce((total, row) => total + (row.eventCount || 0), 0);
      const healthKpis = observeAvailable ? renderKpis([
        { key: "performance_events", label: "Eventos de performance", status: "ok", kind: "number", value: expo.observe.totalEvents, note: expo.observe.periodNote },
        { key: "cold_launch_measurements", label: "Medições de cold launch", status: "ok", kind: "number", value: coldLaunchMeasurements, note: "Medições técnicas do tempo de inicialização; não representam launches nem usuários." },
      ], "kpi-row-secondary kpi-row-2") : emptyState();
      return `
        ${appUsageConstructionNotice()}
        ${expoStatus(expo)}
        ${sectionBlock({ id: "sec-app-usage", title: "1. Uso do aplicativo", body: headlineKpis(expo) })}
        ${sectionBlock({ id: "sec-expo-evolution", title: "2. Evolução do uso", body: chartGrid([chartCard({ title: "Usuários únicos por dia", subtitle: "Evolução diária desde o início da telemetria disponível.", body: seriesAvailable ? usageLineChart(expo.usageSeries, { maxItems: 90 }) : emptyState(), footer: seriesAvailable ? "EAS channel:insights" : "" })], 1) })}
        ${sectionBlock({ id: "sec-expo-platform", title: "3. Plataforma", lead: "Eventos de performance por plataforma — não representam usuários únicos.", body: platformAvailable ? hBars(expo.platformSplit, { compact: true, expandable: false, preserveOrder: true }) : emptyState() })}
        ${sectionBlock({ id: "sec-expo-versions", title: "4. Versões em uso", lead: "Ranking por eventos de performance do EAS Observe.", body: `${versionAvailable ? hBars((expo.versionRows || []).map((row) => ({ label: `${row.version} · ${row.platform}`, count: row.events, percent: row.percent })).sort((a, b) => b.count - a.count), { compact: true, preserveOrder: true, initialLimit: 8 }) : emptyState()}<h4 class="subsection-title">Runtime versions e deployments</h4><div id="expo-updates-table-host"><p class="placeholder-note">Carregando…</p></div><h4 class="subsection-title">Builds recentes</h4><div id="expo-builds-table-host"><p class="placeholder-note">Carregando…</p></div>` })}
        ${sectionBlock({ id: "sec-expo-updates", title: "5. Updates", body: `${updateKpis(expo)}<div class="app-update-composition">${updateComposition.length ? hBars(updateComposition, { compact: true, expandable: false, preserveOrder: true }) : emptyState()}</div><h4 class="subsection-title">Por channel e runtime</h4><div id="expo-channel-insights-table-host"><p class="placeholder-note">Carregando…</p></div><h4 class="subsection-title">Insights por grupo de update</h4><div id="expo-update-insights-table-host"><p class="placeholder-note">Carregando…</p></div>` })}
        ${sectionBlock({ id: "sec-expo-health", title: "6. Saúde e performance", lead: "Métricas técnicas agregadas do EAS Observe.", body: `${healthKpis}<div id="expo-performance-table-host"><p class="placeholder-note">Carregando…</p></div>` })}
        ${sectionBlock({ id: "sec-app-context", title: "7. Contexto da base Pharus", lead: "Dados de negócio agregados; não representam usuários únicos do Expo.", body: contextKpis(context) })}
      `;
    },
  });
}
