/**
 * Coletor local de EAS Observe.
 * Não é chamado por /api/expo/usage nem pela Vercel.
 * Destino futuro: n8n, GitHub Actions, cron ou servidor com CLI.
 *
 * Uso:
 *   node scripts/collect-expo-observe.mjs --dry-run
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { easCliAllowed } from "../lib/expo/eas-cli.mjs";
import { resolveExpoProject } from "../lib/expo/expo-client.mjs";
import { getExpoConfig, getExpoToken } from "../lib/expo/expo-env.mjs";
import { fetchObserveEvents, fetchObserveMetricsSummary } from "../lib/expo/observe.mjs";
import { buildObserveSnapshot, maskObserveSample } from "../lib/expo/observe-snapshot.mjs";
import { loadProjectEnv } from "../lib/load-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadProjectEnv(root);

const dryRun = process.argv.includes("--dry-run");
const probeEvents = process.argv.includes("--probe-events");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (process.env.VERCEL) {
  fail("Este coletor não deve rodar na Vercel. Use um ambiente com EAS CLI.");
}

if (!easCliAllowed()) {
  fail("EAS CLI indisponível neste runtime.");
}

const expoConfig = getExpoConfig();
const tokenLoaded = Boolean(getExpoToken());
console.log(`EXPO_ACCESS_TOKEN loaded: ${tokenLoaded}`);
console.log(`EXPO_ACCOUNT loaded: ${Boolean(expoConfig.account)}`);
console.log(`EXPO_PROJECT_SLUG loaded: ${Boolean(expoConfig.slug)}`);
if (!tokenLoaded) fail("EXPO_ACCESS_TOKEN ausente.");

const project = await resolveExpoProject();
console.log(`project resolved: ${Boolean(project.resolved)}`);
if (!project.resolved) fail(project.error || "Projeto Expo não resolvido.");

const collectedAt = new Date().toISOString();
console.log("running: eas observe:metrics-summary --json --non-interactive");
const summary = await fetchObserveMetricsSummary(project.projectId, { timeoutMs: 240_000 });
if (!summary.ok) fail(summary.error || "observe:metrics-summary falhou.");

let observeEvents = {
  skipped: true,
  ok: false,
  note: "A página usa apenas observe:metrics-summary.",
};
if (probeEvents) {
  const events = await fetchObserveEvents(project.projectId, { timeoutMs: 240_000 });
  observeEvents = {
    skipped: false,
    ok: Boolean(events.ok),
    code: events.ok ? null : events.code || null,
  };
}
const snapshot = buildObserveSnapshot(summary.data, { collectedAt });

const payload = {
  dryRun,
  persist: false,
  snapshot_id: snapshot.snapshot_id,
  collected_at: snapshot.collected_at,
  source: snapshot.source,
  command: snapshot.command,
  project: {
    slug: expoConfig.slug,
    account: expoConfig.account,
  },
  observeEvents,
  recommendedFrequency: snapshot.recommendedFrequency,
  dedup: snapshot.dedup,
  versions: snapshot.versions,
  performance: snapshot.performance,
};

if (!dryRun) {
  console.log("Coleta normalizada. Persistência no Supabase ainda não está habilitada. Use --dry-run.");
}

console.log("");
console.log("VERSIONS");
console.log(`records: ${payload.versions.length}`);
console.log("");
console.log("PERFORMANCE");
console.log(`records: ${payload.performance.length}`);
console.log("");
console.log("SAMPLE");
console.log(JSON.stringify({
  persist: false,
  snapshot_id: payload.snapshot_id,
  versions: maskObserveSample(payload.versions.slice(0, 3)),
  performance: maskObserveSample(payload.performance.slice(0, 3)),
  observeEvents: payload.observeEvents,
}, null, 2));
