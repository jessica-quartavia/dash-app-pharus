import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { hBars, usageLineChart } from "../components/charts.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { appUsageConstructionNotice, sectionBlock } from "../components/page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatNumber } from "../utils/format.mjs";

const EVENT_LABELS = {
  page_view: "Visualização de página",
  session_start: "Início de sessão",
  scroll: "Scroll",
  form_start: "Início de formulário",
  form_submit: "Envio de formulário",
  user_engagement: "Engajamento",
  first_visit: "Primeira visita",
  click: "Clique",
};

const PHARUS_KPI_ORDER = [
  ["official", "Clientes oficiais"],
  ["openFinance", "Com Open Finance"],
  ["mechanisms", "Com mecanismos"],
  ["wealth", "Com patrimônio"],
  ["meetings", "Com reuniões"],
  ["journey", "Com jornada iniciada"],
];

function discreteEmpty(text) {
  return `<p class="usage-quiet-empty" role="status">${escapeHtml(text)}</p>`;
}

function sourceChip(label, status) {
  const text = status === "connected" ? "Conectado" : status === "loading" ? "Carregando" : "Indisponível";
  return `<span class="usage-source-chip is-${escapeHtml(status)}"><i aria-hidden="true"></i>${escapeHtml(label)} · ${text}</span>`;
}

function sourcesStatus(data) {
  const sources = data.sources || {};
  return `<div class="usage-source-status" role="status">
    <strong>Fontes</strong>
    ${sourceChip("Google Analytics", sources.analytics || "unavailable")}
    ${sourceChip("Expo / EAS", sources.expo || "unavailable")}
    ${sourceChip("App Pharus", sources.pharus || "unavailable")}
  </div>`;
}

function ga4Kpi(analytics, key, label, description, kind = "number") {
  const value = analytics?.summary?.[key];
  const supported = Boolean(analytics?.availability?.metrics?.[key]) && value != null;
  if (!supported) return null;
  return {
    key,
    label,
    kind,
    digits: kind === "decimal" ? 2 : undefined,
    status: "ok",
    value,
    note: "Google Analytics",
    description,
  };
}

function usageKpiGrid(rows) {
  const visible = (rows || []).filter(Boolean);
  if (!visible.length) return discreteEmpty("Nenhum indicador disponível nesta fonte.");
  return `<div class="app-usage-kpi-grid">${visible.map((item) => `
    <article class="app-usage-kpi">
      <div class="app-usage-kpi-head">
        <span>${escapeHtml(item.label)}</span>
        <span class="app-usage-info" tabindex="0" role="img" aria-label="${escapeHtml(item.note || item.description || "")}" title="${escapeHtml(item.note || item.description || "")}">i</span>
      </div>
      <div class="app-usage-kpi-value">${formatKpiValue(item)}</div>
      <div class="app-usage-kpi-description">${escapeHtml(item.description || "Google Analytics")}</div>
    </article>`).join("")}</div>`;
}

function ga4HeadlineKpis(analytics) {
  const primary = [
    ga4Kpi(analytics, "active1DayUsers", "Usuários ativos · 1 dia", "Usuários distintos no último dia do período"),
    ga4Kpi(analytics, "active7DayUsers", "Usuários ativos · 7 dias", "Usuários distintos em 7 dias"),
    ga4Kpi(analytics, "active28DayUsers", "Usuários ativos · 28 dias", "Usuários distintos em 28 dias"),
    ga4Kpi(analytics, "sessions", "Sessões", "Sessões no período"),
    ga4Kpi(analytics, "newUsers", "Novos usuários", "Novos usuários no período"),
  ];
  const secondary = [
    ga4Kpi(analytics, "sessionsPerUser", "Sessões por usuário", "Média de sessões por usuário ativo", "decimal"),
    analytics?.engagement?.averageEngagementPerActiveUser != null
      ? {
          key: "average_engagement_web",
          label: "Tempo médio de engajamento",
          kind: "duration",
          status: "ok",
          value: analytics.engagement.averageEngagementPerActiveUser,
          note: "Google Analytics",
          description: "Por usuário ativo",
        }
      : null,
  ].filter(Boolean);
  return `${usageKpiGrid(primary)}${secondary.length ? `<div class="app-usage-kpi-followup">${usageKpiGrid(secondary)}</div>` : ""}`;
}

function ga4EngagementKpis(analytics) {
  const engagement = analytics?.engagement || {};
  const rows = [];
  if (analytics?.summary?.sessions != null) {
    rows.push({ key: "sessions", label: "Sessões", kind: "number", status: "ok", value: analytics.summary.sessions, description: "No período consultado", note: "sessions" });
  }
  if (engagement.sessionsPerUser != null) {
    rows.push({ key: "sessions_per_user", label: "Sessões por usuário", kind: "decimal", digits: 2, status: "ok", value: engagement.sessionsPerUser, description: "Métrica oficial da Data API", note: "sessionsPerUser" });
  }
  if (engagement.averageEngagementPerActiveUser != null) {
    rows.push({ key: "average_engagement", label: "Tempo médio de engajamento", kind: "duration", status: "ok", value: engagement.averageEngagementPerActiveUser, description: "Por usuário ativo", note: engagement.averageEngagementPerActiveUserSource || "userEngagementDuration / activeUsers" });
  }
  if (engagement.averageSessionDuration != null) {
    rows.push({ key: "average_session_duration", label: "Duração média da sessão", kind: "duration", status: "ok", value: engagement.averageSessionDuration, description: "Métrica oficial da Data API", note: "averageSessionDuration" });
  }
  return usageKpiGrid(rows);
}

function platformSummary(analytics) {
  const kind = analytics?.classification?.kind;
  if (!analytics?.available) return discreteEmpty("Plataforma ainda não confirmada.");
  if (kind === "web") {
    return `<div class="usage-platform-pill"><span>Plataforma detectada</span><strong>Web</strong></div>`;
  }
  const rows = (analytics.platformSplit || []).filter((row) => row.count != null);
  if (!rows.length) return discreteEmpty("Nenhuma plataforma retornada.");
  return hBars(rows, { compact: true, expandable: false, preserveOrder: true });
}

function eventLabel(name) {
  return EVENT_LABELS[name] ? `${EVENT_LABELS[name]} · ${name}` : name;
}

function expoAvailableKpis(expo) {
  const rows = (expo.usageKpis || []).filter((item) => item.status === "ok" && item.value != null);
  if (!rows.length) return "";
  return kpiRow(rows.map((item) => kpiCard(item.label, formatKpiValue(item), "Expo / EAS", { featured: true, tooltip: item.note })), "kpi-row-secondary kpi-row-3");
}

function contextKpis(pharus) {
  if (!pharus?.available) return discreteEmpty("Contexto da base Pharus indisponível.");
  const byKey = Object.fromEntries((pharus.kpis || []).map((item) => [item.key, item]));
  const rows = PHARUS_KPI_ORDER.map(([key, label]) => {
    const item = byKey[key];
    if (!item || item.value == null) return null;
    return kpiCard(label, formatNumber(item.value), "", { compact: true });
  }).filter(Boolean);
  if (!rows.length) return discreteEmpty("Contexto da base Pharus indisponível.");
  return kpiRow(rows, "kpi-row-secondary");
}

function expoSectionBody(expo, { kpis = "", extra = "" } = {}) {
  if (expo?.loading) return discreteEmpty("Carregando dados técnicos do Expo/EAS…");
  if (!expo?.available) return discreteEmpty("Dados do Expo/EAS indisponíveis no momento.");
  return `${kpis}${extra}`;
}

export function renderUtilizacaoApp(data = {}) {
  const analytics = data.analytics || data.firebase || {};
  const expo = data.expo || {};
  const pharus = data.pharus || data.context || {};
  const ga4Series = analytics.available && analytics.usageSeries?.length;
  const ga4Events = analytics.available && analytics.events?.length;
  const expoSeries = expo.available && expo.usageSeriesStatus === "available" && expo.usageSeries?.length;
  const expoVersions = expo.available && expo.versionRows?.length;
  const observeAvailable = Boolean(expo.available && expo.observe?.configured);
  const periodNote = analytics.period?.startDate
    ? "O filtro de período é aplicado ao Google Analytics."
    : "O Google Analytics usa os últimos 30 dias quando nenhum período é escolhido.";

  return `
    ${appUsageConstructionNotice()}
    ${sourcesStatus(data)}
    ${sectionBlock({ id: "sec-web-usage", title: "1. Uso da plataforma Web", lead: periodNote, body: analytics.available ? ga4HeadlineKpis(analytics) : discreteEmpty("Google Analytics indisponível no momento.") })}
    ${sectionBlock({ id: "sec-ga4-evolution", title: "2. Evolução de uso", body: chartGrid([chartCard({ title: "Usuários ativos por dia", subtitle: "Série diária do Google Analytics, sem preencher datas ausentes.", body: ga4Series ? usageLineChart(analytics.usageSeries, { maxItems: 90, unit: "activeUsers" }) : discreteEmpty("Série diária indisponível."), footer: ga4Series ? "Google Analytics" : "" })], 1) })}
    ${sectionBlock({ id: "sec-ga4-engagement", title: "3. Engajamento", body: analytics.available ? ga4EngagementKpis(analytics) : discreteEmpty("Engajamento indisponível.") })}
    ${sectionBlock({ id: "sec-ga4-events", title: "4. Principais eventos", body: ga4Events ? hBars((analytics.events || []).map((row) => ({ label: eventLabel(row.name), count: row.count, percent: row.percent, name: row.name })), { compact: true, preserveOrder: true, initialLimit: 8 }) : discreteEmpty("Nenhum evento retornado.") })}
    ${sectionBlock({ id: "sec-ga4-platform", title: "Plataforma", body: platformSummary(analytics) })}
    ${sectionBlock({ id: "sec-expo-usage", title: "5. Uso do aplicativo", lead: "Somente telemetria Expo/EAS Insights. Não é misturada com o Google Analytics Web.", body: expoSectionBody(expo, { kpis: expoAvailableKpis(expo), extra: expoSeries ? chartGrid([chartCard({ title: "Usuários únicos por dia", subtitle: "EAS channel:insights", body: usageLineChart(expo.usageSeries, { maxItems: 90 }), footer: "Expo / EAS" })], 1) : (expo.available ? discreteEmpty("Série diária de usuários únicos não retornada pelo EAS Insights.") : "") }) })}
    ${sectionBlock({ id: "sec-expo-versions", title: "6. Versões do App", body: expoSectionBody(expo, { extra: expoVersions ? hBars((expo.versionRows || []).map((row) => ({ label: `${row.version} · ${row.platform}`, count: row.events, percent: row.percent })).sort((a, b) => b.count - a.count), { compact: true, preserveOrder: true, initialLimit: 8 }) : discreteEmpty("Nenhuma versão de app retornada pelo Expo/EAS.") }) })}
    ${sectionBlock({ id: "sec-expo-updates", title: "7. Updates e runtime", body: expoSectionBody(expo, { extra: `<h4 class="subsection-title">Por channel e runtime</h4><div id="expo-channel-insights-table-host"><p class="placeholder-note">Carregando…</p></div><h4 class="subsection-title">Insights por grupo de update</h4><div id="expo-update-insights-table-host"><p class="placeholder-note">Carregando…</p></div><h4 class="subsection-title">Runtime versions e deployments</h4><div id="expo-updates-table-host"><p class="placeholder-note">Carregando…</p></div>` }) })}
    ${sectionBlock({ id: "sec-expo-builds", title: "8. Builds e deployments", body: expoSectionBody(expo, { extra: `<div id="expo-builds-table-host"><p class="placeholder-note">Carregando…</p></div>` }) })}
    ${sectionBlock({ id: "sec-expo-health", title: "9. Saúde e performance", lead: "EAS Observe, quando a fonte retornar eventos.", body: expoSectionBody(expo, { extra: observeAvailable ? `<div id="expo-performance-table-host"><p class="placeholder-note">Carregando…</p></div>` : discreteEmpty("Observe não retornou medições neste momento.") }) })}
    ${sectionBlock({ id: "sec-app-context", title: "10. Contexto da base Pharus", lead: "Estes indicadores representam a base de clientes e não usuários únicos do Google Analytics ou Expo.", body: contextKpis(pharus) })}
  `;
}
