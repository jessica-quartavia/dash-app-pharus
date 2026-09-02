import { chartCard, chartGrid } from "../components/chart-card.mjs";
import { hBars, usageLineChart } from "../components/charts.mjs";
import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { appUsageConstructionNotice, sectionBlock } from "../components/page-kit.mjs";
import {
  sectionEmpty,
  sectionError,
  sectionLoading,
  sectionUnavailable,
  skeletonChart,
  skeletonKpiGrid,
  skeletonTable,
} from "../components/skeleton.mjs";
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

const KPI_TOOLTIPS = {
  active7DayUsers: "Quantidade de usuários distintos que utilizaram a plataforma nos últimos 7 dias.",
  active1DayUsers: "Quantidade de usuários distintos que utilizaram a plataforma no período mais recente de 1 dia.",
  averageSessionDuration: "Tempo médio de duração de cada sessão registrada pelo Google Analytics.",
  active28DayUsers: "Quantidade de usuários distintos que utilizaram a plataforma nos últimos 28 dias.",
  sessions: "Quantidade de sessões registradas no período consultado.",
  newUsers: "Usuários que tiveram o primeiro engajamento no período.",
  sessionsPerUser: "Em média, quantas sessões cada usuário realizou no período.",
  averageEngagement: "Tempo médio de engajamento por usuário ativo no período.",
};

function sourceChip(label, status) {
  const labels = {
    connected: "conectado",
    loading: "carregando",
    error: "erro",
    idle: "aguardando",
  };
  const text = labels[status] || "erro";
  return `<span class="usage-source-chip is-${escapeHtml(status)}"><i aria-hidden="true"></i>${escapeHtml(label)} · ${text}</span>`;
}

function sourcesStatus(data) {
  const sources = data.sources || {};
  return `<div class="usage-source-status" role="status">
    <strong>Fontes</strong>
    ${sourceChip("Google Analytics", sources.analytics || "error")}
    ${sourceChip("Expo / EAS", sources.expo || "error")}
    ${sourceChip("App Pharus", sources.pharus || "error")}
  </div>`;
}

function analyticsError() {
  return sectionError({
    title: "Não foi possível carregar as métricas de utilização.",
    retrySource: "analytics",
  });
}

function expoLoading() {
  return `${sectionLoading({
    title: "Carregando dados do Expo/EAS…",
    text: "Essa fonte pode levar alguns segundos.",
  })}${skeletonTable({ rows: 4, columns: 4 })}`;
}

function expoError() {
  return sectionError({
    title: "Não foi possível carregar os dados técnicos do Expo/EAS.",
    retrySource: "expo",
  });
}

function pharusError() {
  return sectionError({
    title: "Não foi possível carregar o contexto da base Pharus.",
    retrySource: "pharus",
  });
}

function ga4Kpi(analytics, key, label, description, { kind = "number", tooltip, source } = {}) {
  const value = source === "engagement" ? analytics?.engagement?.[key] : analytics?.summary?.[key];
  const supported = source === "engagement"
    ? value != null
    : Boolean(analytics?.availability?.metrics?.[key]) && value != null;
  if (!supported) return null;
  return {
    key,
    label,
    kind,
    digits: kind === "decimal" ? 2 : undefined,
    status: "ok",
    value,
    tooltip: tooltip || KPI_TOOLTIPS[key] || description,
    description,
  };
}

function infoButton(text) {
  const label = text || "";
  return `<button type="button" class="app-usage-info" aria-label="${escapeHtml(label)}" data-ui-tooltip="${escapeHtml(label)}">i</button>`;
}

function usageKpiGrid(rows, { featured = false } = {}) {
  const visible = (rows || []).filter(Boolean);
  if (!visible.length) return "";
  const gridClass = featured ? "app-usage-kpi-grid is-primary" : "app-usage-kpi-grid is-secondary";
  return `<div class="${gridClass}">${visible.map((item) => `
    <article class="app-usage-kpi${featured ? " is-featured" : ""}">
      <div class="app-usage-kpi-head">
        <span>${escapeHtml(item.label)}</span>
        ${infoButton(item.tooltip || item.description || "")}
      </div>
      <div class="app-usage-kpi-value">${formatKpiValue(item)}</div>
      <div class="app-usage-kpi-description">${escapeHtml(item.description || "")}</div>
    </article>`).join("")}</div>`;
}

function ga4HeadlineKpis(analytics) {
  const primary = [
    ga4Kpi(analytics, "active7DayUsers", "Usuários ativos · 7 dias", "Usuários distintos nos últimos 7 dias"),
    ga4Kpi(analytics, "active1DayUsers", "Usuários ativos · 1 dia", "Usuários distintos no último dia"),
    ga4Kpi(analytics, "averageSessionDuration", "Duração média da sessão", "Tempo médio de cada sessão", {
      kind: "duration",
      source: "engagement",
      tooltip: KPI_TOOLTIPS.averageSessionDuration,
    }),
  ];
  const secondary = [
    ga4Kpi(analytics, "active28DayUsers", "Usuários ativos · 28 dias", "Usuários distintos em 28 dias"),
    ga4Kpi(analytics, "sessions", "Sessões", "Sessões no período"),
    ga4Kpi(analytics, "newUsers", "Novos usuários", "Primeiro engajamento no período"),
    ga4Kpi(analytics, "sessionsPerUser", "Sessões por usuário", "Média de sessões por usuário", { kind: "decimal" }),
    analytics?.engagement?.averageEngagementPerActiveUser != null
      ? {
          key: "average_engagement_web",
          label: "Tempo médio de engajamento",
          kind: "duration",
          status: "ok",
          value: analytics.engagement.averageEngagementPerActiveUser,
          tooltip: KPI_TOOLTIPS.averageEngagement,
          description: "Por usuário ativo",
        }
      : null,
  ];
  const primaryHtml = usageKpiGrid(primary, { featured: true });
  const secondaryHtml = usageKpiGrid(secondary);
  if (!primaryHtml && !secondaryHtml) return sectionUnavailable();
  return `${primaryHtml}${secondaryHtml ? `<div class="app-usage-kpi-followup">${secondaryHtml}</div>` : ""}`;
}

function ga4EngagementKpis(analytics) {
  const engagement = analytics?.engagement || {};
  const rows = [];
  if (engagement.sessionsPerUser != null) {
    rows.push({
      key: "sessions_per_user",
      label: "Sessões por usuário",
      kind: "decimal",
      digits: 2,
      status: "ok",
      value: engagement.sessionsPerUser,
      description: "Média no período",
      tooltip: KPI_TOOLTIPS.sessionsPerUser,
    });
  }
  if (engagement.averageEngagementPerActiveUser != null) {
    rows.push({
      key: "average_engagement",
      label: "Tempo médio de engajamento",
      kind: "duration",
      status: "ok",
      value: engagement.averageEngagementPerActiveUser,
      description: "Por usuário ativo",
      tooltip: KPI_TOOLTIPS.averageEngagement,
    });
  }
  if (engagement.averageSessionDuration != null) {
    rows.push({
      key: "average_session_duration",
      label: "Duração média da sessão",
      kind: "duration",
      status: "ok",
      value: engagement.averageSessionDuration,
      description: "Por sessão",
      tooltip: KPI_TOOLTIPS.averageSessionDuration,
    });
  }
  return usageKpiGrid(rows) || sectionUnavailable();
}

function eventLabel(name) {
  return EVENT_LABELS[name] ? `${EVENT_LABELS[name]} · ${name}` : name;
}

function analyticsSection(analytics, successBody, { kpis = false, chart = false } = {}) {
  if (analytics?.loading) {
    if (kpis) return `${skeletonKpiGrid({ count: 3, featured: true })}${skeletonKpiGrid({ count: 4 })}`;
    if (chart) return skeletonChart({ height: 320 });
    return skeletonKpiGrid({ count: 3 });
  }
  if (!analytics?.available) return analyticsError();
  return successBody();
}

function contextKpis(pharus) {
  if (pharus?.loading) {
    return kpiRow(
      PHARUS_KPI_ORDER.map(([key, label]) => kpiCard(label, "", "", { compact: true, loading: true, key })),
      "kpi-row-secondary",
    );
  }
  if (!pharus?.available) return pharusError();
  const byKey = Object.fromEntries((pharus.kpis || []).map((item) => [item.key, item]));
  const rows = PHARUS_KPI_ORDER.map(([key, label]) => {
    const item = byKey[key];
    if (!item || item.value == null) return null;
    return kpiCard(label, formatNumber(item.value), "", { compact: true });
  }).filter(Boolean);
  if (!rows.length) return sectionEmpty("Sem dados no período");
  return kpiRow(rows, "kpi-row-secondary");
}

function expoCap(expo, key) {
  return expo?.capabilities?.[key] === true;
}

function expoVersionsBody(expo) {
  if (expoCap(expo, "versions") && expo.versionRows?.length) {
    return hBars((expo.versionRows || []).map((row) => ({ label: `${row.version} · ${row.platform}`, count: row.events, percent: row.percent })).sort((a, b) => b.count - a.count), { compact: true, preserveOrder: true, initialLimit: 8 });
  }
  if (expoCap(expo, "versions")) return sectionEmpty("Sem dados no período");
  return sectionUnavailable("Dados de versões aguardando sincronização.");
}

function expoUpdatesBody(expo) {
  const channelHost = expoCap(expo, "channelInsights")
    ? `<div id="expo-channel-insights-table-host"></div>`
    : expoCap(expo, "runtimes") || expoCap(expo, "channels")
      ? `<div id="expo-channel-runtime-table-host"></div>`
      : sectionUnavailable();
  const insightsHost = expoCap(expo, "updateInsights")
    ? `<div id="expo-update-insights-table-host"></div>`
    : `<p class="usage-quiet-empty">Dados de insights detalhados disponíveis apenas no diagnóstico local</p>`;
  const runtimeHost = expoCap(expo, "runtimes") || (expo.updates || []).length
    ? `<div id="expo-updates-table-host"></div>`
    : sectionUnavailable();
  return `<h4 class="subsection-title">Por channel e runtime</h4>${channelHost}<h4 class="subsection-title">Insights por grupo de update</h4>${insightsHost}<h4 class="subsection-title">Runtime versions e deployments</h4>${runtimeHost}`;
}

function expoBuildsBody(expo) {
  if (expoCap(expo, "builds") || (expo.builds || []).length) return `<div id="expo-builds-table-host"></div>`;
  return sectionUnavailable();
}

function expoHealthBody(expo) {
  if (expoCap(expo, "observe")) return `<div id="expo-performance-table-host"></div>`;
  return sectionUnavailable("Dados de saúde e performance aguardando sincronização.");
}

function expoSectionBody(expo, extra = "") {
  if (expo?.loading) return expoLoading();
  if (!expo?.available) return expoError();
  return extra;
}

export function renderUtilizacaoApp(data = {}) {
  const analytics = data.analytics || data.firebase || {};
  const expo = data.expo || {};
  const pharus = data.pharus || data.context || {};
  const ga4Series = analytics.available && analytics.usageSeries?.length;
  const ga4Events = analytics.available && analytics.events?.length;
  const periodNote = analytics.period?.startDate
    ? "O filtro de período é aplicado ao Google Analytics."
    : "O Google Analytics usa os últimos 30 dias quando nenhum período é escolhido.";

  return `
    ${appUsageConstructionNotice()}
    ${sourcesStatus(data)}
    ${sectionBlock({
      id: "sec-web-usage",
      title: "1. Utilização da plataforma",
      lead: periodNote,
      body: analyticsSection(analytics, () => ga4HeadlineKpis(analytics), { kpis: true }),
    })}
    ${sectionBlock({
      id: "sec-ga4-evolution",
      title: "2. Evolução de uso",
      body: chartGrid([chartCard({
        title: "Usuários ativos por dia",
        subtitle: "Evolução diária de usuários ativos no período selecionado.",
        body: analyticsSection(
          analytics,
          () => (ga4Series ? usageLineChart(analytics.usageSeries, { maxItems: 90, unit: "activeUsers" }) : sectionEmpty("Sem dados no período")),
          { chart: true },
        ),
        footer: ga4Series ? "Fonte: Google Analytics" : "",
      })], 1),
    })}
    ${sectionBlock({
      id: "sec-ga4-engagement",
      title: "3. Engajamento",
      body: analyticsSection(analytics, () => ga4EngagementKpis(analytics)),
    })}
    ${sectionBlock({
      id: "sec-ga4-events",
      title: "4. Principais eventos",
      body: analyticsSection(
        analytics,
        () => (ga4Events
          ? hBars((analytics.events || []).map((row) => ({ label: eventLabel(row.name), count: row.count, percent: row.percent, name: row.name })), { compact: true, preserveOrder: true, initialLimit: 8 })
          : sectionEmpty("Sem dados no período")),
        { chart: true },
      ),
    })}
    ${sectionBlock({
      id: "sec-expo-versions",
      title: "5. Versões do App",
      lead: "Informação técnica do Expo/EAS, não um indicador de usuários da plataforma.",
      body: expoSectionBody(expo, expoVersionsBody(expo)),
    })}
    ${sectionBlock({
      id: "sec-expo-updates",
      title: "6. Updates e runtime",
      body: expoSectionBody(expo, expoUpdatesBody(expo)),
    })}
    ${sectionBlock({
      id: "sec-expo-builds",
      title: "7. Builds e deployments",
      body: expoSectionBody(expo, expoBuildsBody(expo)),
    })}
    ${sectionBlock({
      id: "sec-expo-health",
      title: "8. Saúde e performance",
      lead: "Medições técnicas do EAS Observe, quando a fonte retornar eventos.",
      body: expoSectionBody(expo, expoHealthBody(expo)),
    })}
    ${sectionBlock({
      id: "sec-app-context",
      title: "9. Contexto da base Pharus",
      lead: "Estes indicadores representam a base de clientes e não usuários únicos do Google Analytics ou Expo.",
      body: contextKpis(pharus),
    })}
  `;
}
