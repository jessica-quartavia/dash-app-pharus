export const ANALYTICS_FALLBACK = {
  available: false,
  loading: false,
  status: "error",
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
  status: "error",
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
  status: "error",
  kpis: [],
  userMessage: "Contexto da base Pharus indisponível.",
};

export const ANALYTICS_LOADING = { ...ANALYTICS_FALLBACK, loading: true, status: "loading", available: false };
export const EXPO_LOADING = { ...EXPO_FALLBACK, loading: true, status: "loading", available: false };
export const PHARUS_LOADING = { ...PHARUS_FALLBACK, loading: true, status: "loading", available: false };

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

function normalizeSource(source, fallback) {
  const next = source && typeof source === "object" ? { ...fallback, ...source } : { ...fallback };
  if (next.loading) {
    next.status = "loading";
    next.loading = true;
    return next;
  }
  if (next.available) {
    next.status = "success";
    next.loading = false;
    return next;
  }
  next.status = next.status === "idle" ? "idle" : "error";
  next.loading = false;
  return next;
}

export function sourceStatus(source, { connectedWhen } = {}) {
  const normalized = normalizeSource(source, { available: false, loading: false, status: "idle" });
  if (normalized.status === "loading" || normalized.loading) return "loading";
  if (normalized.status === "idle") return "idle";
  if (connectedWhen ? connectedWhen(normalized) : normalized.available) return "connected";
  return "error";
}

export function mergeUsageSources({ analytics, expo, pharus }) {
  const nextAnalytics = normalizeSource(analytics, ANALYTICS_FALLBACK);
  const nextExpo = normalizeSource(expo, EXPO_FALLBACK);
  const nextPharus = normalizeSource(pharus, PHARUS_FALLBACK);
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

export async function loadUsageSources({
  analyticsTask,
  expoTask,
  pharusTask,
  onPartial,
  previous,
  keepPharusOnReload = true,
  quickWaitMs = 200,
  expoTimeoutMs = 90_000,
  pharusTimeoutMs = 20_000,
} = {}) {
  const analyticsP = safeSource(analyticsTask || (() => ANALYTICS_FALLBACK), ANALYTICS_FALLBACK);
  const expoP = safeSource(expoTask || (() => EXPO_FALLBACK), EXPO_FALLBACK);
  const pharusP = safeSource(pharusTask || (() => PHARUS_FALLBACK), PHARUS_FALLBACK);

  const keepPharus = keepPharusOnReload && (previous?.pharus?.available || previous?.pharus?.status === "success");
  onPartial?.(mergeUsageSources({
    analytics: ANALYTICS_LOADING,
    expo: EXPO_LOADING,
    pharus: keepPharus ? previous.pharus : PHARUS_LOADING,
  }));

  const analytics = await analyticsP;
  const [expoQuick, pharusQuick] = await Promise.all([
    Promise.race([expoP, delay(quickWaitMs).then(() => null)]),
    Promise.race([pharusP, delay(quickWaitMs).then(() => null)]),
  ]);

  const state = {
    analytics,
    expo: expoQuick || EXPO_LOADING,
    pharus: pharusQuick || (keepPharus ? previous.pharus : PHARUS_LOADING),
  };

  if (!expoQuick) {
    withTimeout(expoP, expoTimeoutMs, EXPO_FALLBACK).then((expo) => {
      state.expo = expo;
      onPartial?.(mergeUsageSources(state));
    });
  }
  if (!pharusQuick && !keepPharus) {
    withTimeout(pharusP, pharusTimeoutMs, PHARUS_FALLBACK).then((pharus) => {
      state.pharus = pharus;
      onPartial?.(mergeUsageSources(state));
    });
  } else if (!pharusQuick && keepPharus) {
    withTimeout(pharusP, pharusTimeoutMs, previous.pharus).then((pharus) => {
      state.pharus = pharus;
      onPartial?.(mergeUsageSources(state));
    });
  }

  return mergeUsageSources(state);
}

export async function retryUsageSource(source, {
  analyticsTask,
  expoTask,
  pharusTask,
  current,
} = {}) {
  const next = {
    analytics: current?.analytics || ANALYTICS_FALLBACK,
    expo: current?.expo || EXPO_FALLBACK,
    pharus: current?.pharus || PHARUS_FALLBACK,
  };
  if (source === "analytics") next.analytics = await safeSource(analyticsTask || (() => ANALYTICS_FALLBACK), ANALYTICS_FALLBACK);
  if (source === "expo") next.expo = await safeSource(expoTask || (() => EXPO_FALLBACK), EXPO_FALLBACK);
  if (source === "pharus") next.pharus = await safeSource(pharusTask || (() => PHARUS_FALLBACK), PHARUS_FALLBACK);
  return mergeUsageSources(next);
}
