import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountInteractiveTable } from "../components/interactive-table.mjs";
import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { dailyColumns, donut } from "../components/charts.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { expoSourceBanner, sectionBlock } from "../components/page-kit.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getExpoUsagePage } from "../services/app-pharus/expo-usage.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatNumber } from "../utils/format.mjs";

const UNAVAILABLE = "Não disponível";
const UNAVAILABLE_LONG = "Não disponível pela integração atual do Expo";
const SOURCE_FOOTNOTE = "Fonte: Expo / EAS";

function unavailableBlock(note = "") {
  return `<p class="placeholder-note">${escapeHtml(UNAVAILABLE_LONG)}${note ? `<span class="note-muted"> · ${escapeHtml(note)}</span>` : ""}</p>`;
}

function telemetryNote(data) {
  if (data.telemetryStartInsights) {
    return `<p class="note-muted">Dados disponíveis a partir de ${escapeHtml(data.telemetryStartInsights)} (EAS Insights · canal production).</p>`;
  }
  if (data.usageSeriesStatus === "no_history") {
    return `<p class="note-muted">Sem histórico de telemetria no período consultado.</p>`;
  }
  return "";
}

function integrationStatus(data) {
  if (data.available && data.integration?.projectResolved) {
    return `<p class="note-muted">Projeto <strong>${escapeHtml(data.integration.fullName || "")}</strong> · telemetria agregada Expo/EAS, independente da base Supabase.</p>`;
  }
  const message = data.userMessage || "Integração com Expo em configuração";
  return `<div class="gd-status" role="status"><strong>${escapeHtml(message)}</strong><span>Telemetria do aplicativo via Expo/EAS. Os demais dados do dashboard não são afetados.</span></div>`;
}

function formatDiagCell(status, value) {
  if (status !== "available") return escapeHtml(UNAVAILABLE);
  return formatNumber(value ?? 0);
}

function productionChannelRows(rows) {
  return (rows || []).filter((row) => row.channel === "production");
}

function secondaryChannelRows(rows) {
  return (rows || []).filter((row) => row.channel !== "production");
}

function channelDiagnosticsTable(rows, { showAll = false } = {}) {
  const list = showAll ? rows : productionChannelRows(rows);
  if (!list?.length) return unavailableBlock("EAS channel:insights");
  return `<div class="table-scroll">
    <table class="data-table">
      <thead>
        <tr>
          <th>Canal</th>
          <th>Runtime</th>
          <th>Embedded</th>
          <th>OTA</th>
          <th>Falhas</th>
          <th>Respondeu?</th>
        </tr>
      </thead>
      <tbody>
        ${list
          .map(
            (row) => `<tr>
              <td>${escapeHtml(row.channel || "—")}</td>
              <td><code>${escapeHtml(row.runtimeVersionShort || String(row.runtimeVersion || "—").slice(0, 16))}…</code></td>
              <td>${formatDiagCell(row.embeddedStatus, row.embeddedUsers)}</td>
              <td>${formatDiagCell(row.otaStatus, row.otaUsers)}</td>
              <td>${formatDiagCell(row.failuresStatus, row.failures)}</td>
              <td>${row.responded ? "Sim" : "Não"}</td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function usageKpis(data) {
  const usage = (data.usageKpis || data.kpis || []).filter((kpi) =>
    ["embedded_unique_users", "ota_unique_users", "observe_events"].includes(kpi.key),
  );
  if (!usage.length) {
    return kpiRow([
      kpiCard("Usuários únicos (production)", UNAVAILABLE_LONG, "EAS channel:insights.", { featured: true }),
      kpiCard("Eventos de performance", UNAVAILABLE_LONG, "EAS Observe.", { featured: true }),
    ]);
  }
  return kpiRow(
    usage.map((kpi) =>
      kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, {
        featured: true,
        tooltip: kpi.note,
      }),
    ),
    "kpi-row-primary",
  );
}

function healthKpis(data) {
  const health = (data.usageKpis || data.kpis || []).filter((kpi) => kpi.key === "failed_installs");
  if (!health.length) {
    const failedRow = productionChannelRows(data.channelDiagnostics || [])[0];
    if (failedRow?.failuresStatus === "available") {
      return kpiRow([kpiCard("Instalações com falha", formatNumber(failedRow.failures ?? 0), "EAS channel:insights (production).", {})]);
    }
    return kpiRow([kpiCard("Instalações com falha", UNAVAILABLE_LONG, "EAS channel:insights.", {})]);
  }
  return kpiRow(health.map((kpi) => kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, { tooltip: kpi.note })));
}

const buildsTable = mountInteractiveTable("expo-builds-table-host", {
  defaultState: { sortKey: "createdAt", sortDir: "desc" },
  rowIdKey: "id",
  searchPlaceholder: "Buscar build por plataforma ou versão",
  title: (rows) => `${formatNumber(rows.length)} builds recentes`,
  columns: [
    { key: "platform", label: "Plataforma", sortable: true, value: (row) => escapeHtml(row.platform || "—") },
    { key: "version", label: "Versão", sortable: true, value: (row) => escapeHtml(row.version || "—") },
    { key: "status", label: "Status", sortable: true, value: (row) => escapeHtml(row.status || "—") },
    {
      key: "createdAt",
      label: "Criado em",
      sortable: true,
      sortValue: (row) => row.createdAt || "",
      value: (row) => formatDate(row.createdAt),
    },
  ],
  onRowClick: () => {},
});

const versionTable = mountInteractiveTable("expo-version-table-host", {
  rowIdKey: "id",
  searchPlaceholder: "Buscar versão ou plataforma",
  title: () => "Eventos por versão do App",
  columns: [
    { key: "version", label: "App version", sortable: true, value: (row) => escapeHtml(row.version || "—") },
    { key: "platform", label: "Plataforma", sortable: true, value: (row) => escapeHtml(row.platform || "—") },
    {
      key: "events",
      label: "Eventos",
      sortable: true,
      numeric: true,
      value: (row) => (row.events != null ? formatNumber(row.events) : "—"),
    },
    {
      key: "percent",
      label: "%",
      sortable: true,
      numeric: true,
      value: (row) => (row.percent != null ? `${row.percent}%` : "—"),
    },
  ],
  onRowClick: () => {},
});

export function bootUtilizacaoApp() {
  mountPage({
    pageId: "utilizacao_app",
    filterNote:
      "Período aplicado ao EAS channel:insights quando suportado. EAS Observe retorna resumo acumulado sem filtro de datas.",
    load: getExpoUsagePage,
    render: (data) => {
      queueMicrotask(() => {
        buildsTable.mount({ rows: data.builds || [] });
        versionTable.mount({ rows: data.versionRows || [] });
      });

      const hasUsageSeries = data.usageSeriesStatus === "available" && data.usageSeries?.length > 0;
      const usageChartBody = hasUsageSeries
        ? dailyColumns(data.usageSeries, { valueKey: "count", titleSuffix: "Usuários únicos", maxItems: 90 })
        : data.usageSeriesStatus === "no_history"
          ? `<p class="placeholder-note">Sem histórico de telemetria no período consultado.</p>`
          : unavailableBlock("EAS channel:insights · production");

      const platformChartBody =
        data.availability?.platformSplit === "ok" && data.platformSplit?.length
          ? donut(data.platformSplit)
          : unavailableBlock("EAS Observe");

      const secondaryChannels = secondaryChannelRows(data.channelDiagnostics || []);
      const showSecondaryChannels = secondaryChannels.some(
        (row) => row.responded && ((row.embeddedUsers ?? 0) > 0 || (row.otaUsers ?? 0) > 0),
      );

      return `
        ${expoSourceBanner()}
        ${integrationStatus(data)}

        ${sectionBlock({
          id: "sec-expo-usage",
          title: "1. Uso do aplicativo",
          lead: "Canal production · usuários únicos anônimos via EAS channel:insights. Não comparar com clientes Supabase.",
          body: `${usageKpis(data)}${telemetryNote(data)}${chartGrid([
            chartCard({
              title: "Evolução de uso",
              subtitle: "Usuários únicos diários (update embarcado · production)",
              body: usageChartBody,
              footer: hasUsageSeries ? SOURCE_FOOTNOTE : "",
            }),
          ])}${channelDiagnosticsTable(data.channelDiagnostics)}`,
        })}

        ${sectionBlock({
          id: "sec-expo-platforms",
          title: "2. Plataformas e versões",
          body: `${chartGrid([
            chartCard({
              title: "Android x iOS",
              subtitle: "Distribuição dos eventos de performance por plataforma (EAS Observe). Não representa usuários únicos.",
              body: platformChartBody,
              footer: data.availability?.platformSplit === "ok" ? SOURCE_FOOTNOTE : "",
            }),
          ])}<div id="expo-version-table-host"><p class="placeholder-note">Carregando…</p></div>
          <p class="note-muted">Distribuição dos eventos de performance registrados pelo EAS Observe. Não representa usuários únicos nem clientes Pharus.</p>
          ${data.observe?.periodNote ? `<p class="note-muted">${escapeHtml(data.observe.periodNote)}</p>` : ""}`,
        })}

        ${sectionBlock({
          id: "sec-expo-health",
          title: "3. Saúde técnica",
          lead: "Falhas de instalação (Insights) e performance agregada (Observe).",
          body: `${healthKpis(data)}${
            data.observe?.configured
              ? `<p class="note-muted">EAS Observe ativo · ${formatNumber(data.observe.totalEvents || 0)} eventos de performance no resumo acumulado.</p>`
              : `<p class="note-muted">${escapeHtml(UNAVAILABLE_LONG)} (EAS Observe)</p>`
          }`,
        })}

        ${sectionBlock({
          id: "sec-expo-technical",
          title: "4. Informações técnicas do aplicativo",
          lead: "Builds, canais e runtimes. Referência operacional; não são KPIs de negócio.",
          body: `<h4 class="subsection-title">Builds recentes</h4><div id="expo-builds-table-host"><p class="placeholder-note">Carregando…</p></div>
            ${
              showSecondaryChannels
                ? `<h4 class="subsection-title">Outros canais (preview / development)</h4>${channelDiagnosticsTable(secondaryChannels, { showAll: true })}`
                : `<p class="note-muted">Canais preview e development sem utilização registrada no período — omitidos do destaque principal.</p>`
            }`,
        })}
      `;
    },
  });
}
