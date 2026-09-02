import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getPersistedPerformance,
  getPersistedVersions,
  overlayPersistedInsights,
  readPersistedInsights,
} from "../../lib/expo/persisted-insights.mjs";

test("leitura persistida ainda não conecta ao banco", async () => {
  const versions = await getPersistedVersions();
  const performance = await getPersistedPerformance();
  const both = await readPersistedInsights();
  assert.equal(versions.available, false);
  assert.equal(performance.available, false);
  assert.equal(both.versions.available, false);
  assert.equal(versions.status, "not_connected");
  assert.deepEqual(versions.rows, []);
});

test("overlay só preenche versões e observe quando o snapshot persistido existir", () => {
  const empty = overlayPersistedInsights({
    versionRows: [],
    observe: null,
    capabilities: { versions: false, observe: false, availableInServerless: { versions: false, observe: false } },
    persisted: { versions: { available: false, rows: [] }, performance: { available: false, rows: [] } },
  });
  assert.equal(empty.capabilities.versions, false);
  assert.equal(empty.observe, null);

  const overlaid = overlayPersistedInsights({
    versionRows: [],
    observe: null,
    capabilities: { versions: false, observe: false, availableInServerless: { versions: false, observe: false } },
    persisted: {
      versions: {
        available: true,
        rows: [{ platform: "IOS", app_version: "1.2.1", event_count: 20, percentage: 80 }],
      },
      performance: {
        available: true,
        rows: [{
          platform: "IOS",
          app_version: "1.2.1",
          metric_name: "expo.app_startup.cold_launch_time",
          metric_label: "Cold launch",
          metric_value: 0.8,
          metric_value_p90: 1.4,
          event_count: 10,
        }],
      },
    },
  });
  assert.equal(overlaid.capabilities.versions, true);
  assert.equal(overlaid.capabilities.observe, true);
  assert.equal(overlaid.capabilities.availableInServerless.versions, true);
  assert.equal(overlaid.capabilities.availableInServerless.observe, true);
  assert.equal(overlaid.versionRowsSource, "persisted_observe");
  assert.equal(overlaid.observeSource, "persisted_observe");
  assert.equal(overlaid.versionRows[0].version, "1.2.1");
  assert.equal(overlaid.observe.performanceRows[0].medianSeconds, 0.8);
});

test("overlay não substitui Observe live pelo snapshot persistido", () => {
  const overlaid = overlayPersistedInsights({
    versionRows: [{ id: "live", platform: "ANDROID", version: "1.0.2", events: 3, percent: 100 }],
    observe: { configured: true, performanceRows: [], totalEvents: 3 },
    capabilities: { versions: true, observe: true, availableInServerless: { versions: false, observe: false } },
    persisted: {
      versions: { available: true, rows: [{ platform: "IOS", app_version: "9.9.9", event_count: 1, percentage: 100 }] },
      performance: { available: true, rows: [] },
    },
  });
  assert.equal(overlaid.versionRows[0].version, "1.0.2");
  assert.equal(overlaid.versionRowsSource, "eas_observe");
  assert.equal(overlaid.observeSource, "eas_observe");
});

test("API Expo da Vercel não importa o coletor CLI", async () => {
  const source = await readFile(new URL("../../api/expo/usage.js", import.meta.url), "utf8");
  const collector = await readFile(new URL("../../scripts/collect-expo-observe.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /import .*collect-expo-observe|from ["'].*collect-expo-observe/);
  assert.match(source, /não é chamado/);
  assert.doesNotMatch(collector, /createClient|from ["']@supabase/);
  assert.match(collector, /persist: false/);
});
