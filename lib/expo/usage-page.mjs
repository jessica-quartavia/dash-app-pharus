import { buildExpoUsageReport } from "./expo-client.mjs";

const UNAVAILABLE = "Não disponível pela integração atual do Expo";

function unavailableKpi(label, note) {
  return {
    key: label,
    label,
    status: "unavailable",
    kind: "text",
    value: UNAVAILABLE,
    note: note || "Telemetria Expo/EAS separada da base de clientes Supabase.",
  };
}

export function presentExpoUsagePage(report) {
  const integration = report.integration || {};
  const kpis = [];

  for (const item of report.usageKpis || report.summary || []) {
    kpis.push({
      key: item.key,
      label: item.label,
      status: item.status || "ok",
      value: item.value,
      note: item.note,
      kind: item.kind || (typeof item.value === "number" ? "number" : "text"),
    });
  }

  if (!kpis.length) {
    kpis.push(unavailableKpi("Utilização do App"));
  }

  return {
    available: Boolean(report.available),
    userMessage: report.userMessage || null,
    integration: {
      authenticated: integration.authenticated ?? false,
      account: integration.account ?? null,
      projectResolved: integration.projectResolved ?? false,
      projectId: integration.projectId ?? null,
      projectSlug: integration.projectSlug ?? null,
      fullName: integration.fullName ?? null,
    },
    diagnostics: report.diagnostics || {},
    availability: report.availability || {},
    kpis,
    usageKpis: kpis,
    usageSeries: report.usageSeries || [],
    usageSeriesStatus: report.usageSeriesStatus || "unavailable",
    telemetryStartInsights: report.telemetryStartInsights || null,
    channelDiagnostics: report.diagnostics?.channelDiagnostics || report.channelDiagnostics || [],
    platformSplit: report.platformSplit || [],
    platformSplitSource: report.platformSplitSource || null,
    versionRows: report.versionRows || [],
    versionRowsSource: report.versionRowsSource || null,
    updates: report.updates || [],
    builds: report.builds || [],
    channels: report.channels || [],
    channelInsights: report.channelInsights || [],
    observe: report.observe || null,
    period: report.period || {},
    unavailableText: UNAVAILABLE,
    methodology:
      "Telemetria agregada do aplicativo via Expo/EAS. Separada da base oficial de clientes no Supabase.",
  };
}

export async function buildExpoUsageDataset(filters = {}) {
  try {
    const report = await buildExpoUsageReport({
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
    });
    return presentExpoUsagePage(report);
  } catch {
    return presentExpoUsagePage({
      available: false,
      userMessage: "Integração com Expo em configuração",
      integration: { authenticated: false, projectResolved: false },
      usageKpis: [],
      usageSeries: [],
      platformSplit: [],
      versionRows: [],
      updates: [],
      builds: [],
      channels: [],
      channelInsights: [],
    });
  }
}
