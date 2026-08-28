import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { dailyColumns, donut } from "../components/charts.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { appUsageConstructionNotice, appUsageSourceBanner, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getAppUsagePage } from "../services/app-pharus/app-usage.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatNumber, formatPercent } from "../utils/format.mjs";

const UNAVAILABLE = "Não disponível pela integração atual do Expo";

function expoStatus(expo) {
  if (expo.available && expo.integration?.projectResolved) {
    return `<p class="note-muted">Projeto <strong>${escapeHtml(expo.integration.fullName || "")}</strong> · dados técnicos agregados, sem vínculo individual com clientes.</p>`;
  }
  return `<div class="gd-status" role="status"><strong>Integração Expo temporariamente indisponível</strong><span>${escapeHtml(expo.userMessage || "Os dados da base Pharus continuam disponíveis.")}</span></div>`;
}

function expoUsageKpis(expo) {
  const rows = (expo.usageKpis || expo.kpis || []).filter((item) => item.status === "ok");
  if (!rows.length) return `<p class="placeholder-note">${UNAVAILABLE}</p>`;
  return kpiRow(rows.map((item) => kpiCard(item.label, formatKpiValue(item), item.note, { featured: true, tooltip: item.note })), "kpi-row-primary");
}

function contextKpis(context) {
  if (!context.available) return `<p class="placeholder-note">Contexto da base Pharus indisponível.</p>`;
  return kpiRow((context.kpis || []).map((item) => kpiCard(item.label, formatNumber(item.value), "Base oficial do App Pharus", { compact: true })), "kpi-row-secondary");
}

const versionTable = mountInteractiveTable("expo-version-table-host", {
  defaultState: { sortKey: "events", sortDir: "desc" }, rowIdKey: "id",
  title: (rows) => `${formatNumber(rows.length)} versões com eventos`,
  columns: [
    { key: "version", label: "Versão", sortable: true, value: (row) => escapeHtml(row.version || "—") },
    { key: "platform", label: "Plataforma", sortable: true, value: (row) => escapeHtml(row.platform || "—") },
    { key: "events", label: "Eventos", sortable: true, numeric: true, value: (row) => row.events == null ? "—" : formatNumber(row.events) },
    { key: "percent", label: "%", sortable: true, numeric: true, value: (row) => row.percent == null ? "—" : formatPercent(row.percent) },
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
    filterNote: "O período é aplicado às consultas Expo/EAS que suportam datas. O contexto Pharus é uma fotografia agregada atual.",
    load: getAppUsagePage,
    render: ({ expo, context }) => {
      queueMicrotask(() => {
        versionTable.mount({ rows: expo.versionRows || [] });
        buildsTable.mount({ rows: expo.builds || [] });
        updatesTable.mount({ rows: expo.updates || [] });
      });
      const seriesAvailable = expo.usageSeriesStatus === "available" && expo.usageSeries?.length;
      const platformAvailable = expo.availability?.platformSplit === "ok" && expo.platformSplit?.length;
      return `
        ${appUsageConstructionNotice()}
        ${appUsageSourceBanner()}
        ${expoStatus(expo)}
        ${sectionBlock({ id: "sec-app-context", title: "1. Contexto da base Pharus", lead: "Métricas agregadas da base oficial; não representam usuários Expo.", body: `${contextKpis(context)}<p class="note-muted">Não existe chave individual Expo/EAS → auth.users.id comprovada. Nenhum cruzamento heurístico foi realizado.</p>` })}
        ${sectionBlock({ id: "sec-expo-usage", title: "2. Utilização técnica", lead: "Unique users, embedded users, OTA users e eventos somente quando retornados explicitamente pelo Expo/EAS.", body: `${expoUsageKpis(expo)}${chartGrid([chartCard({ title: "Evolução de utilização", subtitle: "A série começa na primeira data real", body: seriesAvailable ? dailyColumns(expo.usageSeries, { titleSuffix: "usuários únicos", maxItems: 90 }) : `<p class="placeholder-note">${UNAVAILABLE}</p>`, footer: seriesAvailable ? "Fonte: Expo / EAS" : "" })])}` })}
        ${sectionBlock({ id: "sec-expo-platform", title: "3. Plataformas e versões", lead: "Android x iOS representa eventos de performance, não usuários únicos.", body: `${chartGrid([chartCard({ title: "Android x iOS", subtitle: "Distribuição de eventos de performance", body: platformAvailable ? donut(expo.platformSplit) : `<p class="placeholder-note">${UNAVAILABLE}</p>`, footer: platformAvailable ? "Fonte: EAS Observe" : "" })])}<div id="expo-version-table-host"><p class="placeholder-note">Carregando…</p></div>` })}
        ${sectionBlock({ id: "sec-expo-health", title: "4. Saúde técnica", body: expo.observe?.configured ? `<p class="note-muted">EAS Observe: ${formatNumber(expo.observe.totalEvents || 0)} eventos de performance no resumo disponível.</p>` : `<p class="placeholder-note">${UNAVAILABLE}</p>` })}
        ${sectionBlock({ id: "sec-expo-tech", title: "5. Builds, channels e runtimes", body: `<h4 class="subsection-title">Builds recentes</h4><div id="expo-builds-table-host"><p class="placeholder-note">Carregando…</p></div><h4 class="subsection-title">Deployments, updates e runtime versions</h4><div id="expo-updates-table-host"><p class="placeholder-note">Carregando…</p></div>` })}
      `;
    },
  });
}
