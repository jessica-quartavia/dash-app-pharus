/**
 * Safe Expo usage payload summary. Never logs tokens or private keys.
 */
function summarize(payload) {
  const channels = Array.isArray(payload?.channels) ? payload.channels : [];
  const updates = Array.isArray(payload?.updates) ? payload.updates : [];
  const versions = Array.isArray(payload?.versionRows) ? payload.versionRows : [];
  const builds = Array.isArray(payload?.builds) ? payload.builds : [];
  const insights = Array.isArray(payload?.channelInsights) ? payload.channelInsights : [];
  const updateInsights = Array.isArray(payload?.updateInsights) ? payload.updateInsights : [];
  const runtimes = [
    ...new Set(
      [
        ...updates.map((row) => row.runtimeVersion).filter(Boolean),
        ...insights.map((row) => row.runtimeVersion).filter(Boolean),
        ...channels.flatMap((channel) =>
          (channel.branches || []).flatMap((branch) =>
            (branch.runtimeVersions || [branch.runtimeVersion]).filter(Boolean),
          ),
        ),
      ].map(String),
    ),
  ];
  return {
    httpOk: payload?._httpStatus,
    available: Boolean(payload?.available),
    projectResolved: Boolean(payload?.integration?.projectResolved),
    authenticated: Boolean(payload?.integration?.authenticated),
    accountLoaded: Boolean(payload?.integration?.account),
    slug: payload?.integration?.projectSlug || null,
    channels: channels.length,
    channelNames: channels.map((row) => row.name).filter(Boolean),
    runtimes: runtimes.length,
    versions: versions.length,
    updates: updates.length,
    builds: builds.length,
    insights: insights.length,
    updateInsights: updateInsights.length,
    observeConfigured: Boolean(payload?.observe?.configured),
    error: payload?.error || payload?.userMessage || null,
    capabilities: payload?.capabilities || null,
  };
}

async function fetchJson(url) {
  const started = Date.now();
  let response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    return {
      _httpStatus: 0,
      available: false,
      error: error instanceof Error ? error.message : "network",
      _ms: Date.now() - started,
    };
  }
  const payload = await response.json().catch(() => ({}));
  return { ...payload, _httpStatus: response.status, _ms: Date.now() - started };
}

const local = summarize(await fetchJson("http://localhost:5173/api/expo/usage"));
const prod = summarize(await fetchJson("https://dash-app-pharus.vercel.app/api/expo/usage"));
console.log(JSON.stringify({ local, prod }, null, 2));
