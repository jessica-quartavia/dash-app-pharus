export const ANALYTICS_FALLBACK = {
  available: false,
  loading: false,
  userMessage: "Google Analytics temporariamente indisponível.",
  integration: { authenticated: false, propertyResolved: false },
  availability: { metrics: {}, dimensions: {} },
  kpis: [],
  summary: {},
  usageSeries: [],
  platformSplit: [],
  versionRows: [],
  events: [],
  engagement: {
    sessionsPerUser: null,
    averageSessionDuration: null,
    userEngagementDuration: null,
    averageEngagementPerActiveUser: null,
  },
  classification: { WEB: null, ANDROID: null, IOS: null, other: [], kind: "unknown" },
  retention: { available: false, message: "Não disponível pela integração atual" },
  userId: { available: false, supabaseMappingConfirmed: false },
};

export const EXPO_FALLBACK = {
  available: false,
  loading: false,
  userMessage: "Expo/EAS temporariamente indisponível.",
  integration: { authenticated: false, projectResolved: false },
  kpis: [],
  headlineKpis: [],
  usageKpis: [],
  usageSeries: [],
  usageSeriesStatus: "unavailable",
  platformSplit: [],
  versionRows: [],
  updates: [],
  builds: [],
  channels: [],
  channelInsights: [],
  updateInsights: [],
  observe: null,
  availability: {},
};

export const PHARUS_FALLBACK = {
  available: false,
  loading: false,
  kpis: [],
  userMessage: "Contexto da base Pharus indisponível.",
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeSource(task, fallback) {
  try {
    const value = await task();
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

export function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export async function loadUsageSources({
  analyticsTask,
  expoTask,
  pharusTask,
  onPartial,
  quickWaitMs = 200,
  expoTimeoutMs = 180_000,
  pharusTimeoutMs = 20_000,
} = {}) {
  const analyticsP = safeSource(analyticsTask || (() => ANALYTICS_FALLBACK), ANALYTICS_FALLBACK);
  const expoP = safeSource(expoTask || (() => EXPO_FALLBACK), EXPO_FALLBACK);
  const pharusP = safeSource(pharusTask || (() => PHARUS_FALLBACK), PHARUS_FALLBACK);

  const analytics = await analyticsP;
  const [expoQuick, pharusQuick] = await Promise.all([
    Promise.race([expoP, delay(quickWaitMs).then(() => null)]),
    Promise.race([pharusP, delay(quickWaitMs).then(() => null)]),
  ]);

  const state = {
    analytics,
    expo: expoQuick || { ...EXPO_FALLBACK, loading: true },
    pharus: pharusQuick || { ...PHARUS_FALLBACK, loading: true },
  };

  if (!expoQuick) {
    withTimeout(expoP, expoTimeoutMs, EXPO_FALLBACK).then((expo) => {
      state.expo = expo;
      onPartial?.(mergeUsageSources(state));
    });
  }
  if (!pharusQuick) {
    withTimeout(pharusP, pharusTimeoutMs, PHARUS_FALLBACK).then((pharus) => {
      state.pharus = pharus;
      onPartial?.(mergeUsageSources(state));
    });
  }

  return mergeUsageSources(state);
}

export function sourceStatus(source, { connectedWhen } = {}) {
  if (source?.loading) return "loading";
  if (connectedWhen ? connectedWhen(source) : source?.available) return "connected";
  return "unavailable";
}

export function mergeUsageSources({ analytics, expo, pharus }) {
  const nextAnalytics = analytics && typeof analytics === "object" ? analytics : ANALYTICS_FALLBACK;
  const nextExpo = expo && typeof expo === "object" ? expo : EXPO_FALLBACK;
  const nextPharus = pharus && typeof pharus === "object" ? pharus : PHARUS_FALLBACK;
  return {
    analytics: nextAnalytics,
    firebase: nextAnalytics,
    expo: nextExpo,
    pharus: nextPharus,
    context: nextPharus,
    sources: {
      analytics: sourceStatus(nextAnalytics, { connectedWhen: (item) => item.available && item.integration?.propertyResolved }),
      expo: sourceStatus(nextExpo, { connectedWhen: (item) => item.available && item.integration?.projectResolved }),
      pharus: sourceStatus(nextPharus, { connectedWhen: (item) => item.available }),
    },
  };
}
