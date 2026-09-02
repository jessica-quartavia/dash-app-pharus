import assert from "node:assert/strict";
import test from "node:test";
import {
  OBSERVE_COMMAND,
  buildObserveSnapshot,
  maskObserveSample,
  performanceDedupKey,
  snapshotIdFrom,
  versionDedupKey,
} from "../../lib/expo/observe-snapshot.mjs";

const sample = {
  versions: [
    {
      platform: "IOS",
      appVersion: "1.2.1",
      buildNumbers: ["18"],
      updateIds: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      metrics: {
        "expo.app_startup.cold_launch_time": { eventCount: 10, median: 0.8, p90: 1.4 },
        "expo.app_startup.tti": { eventCount: 10, median: 1.1, p90: 1.9 },
      },
    },
    {
      platform: "ANDROID",
      appVersion: "1.2.1",
      buildNumbers: ["16"],
      updateIds: ["11111111-2222-3333-4444-555555555555"],
      metrics: {
        "expo.app_startup.cold_launch_time": { eventCount: 5, median: 1.2, p90: 2.0 },
      },
    },
  ],
};

test("snapshot Observe normaliza versões e performance a partir do mesmo comando", () => {
  const snapshot = buildObserveSnapshot(sample, { collectedAt: "2026-09-02T15:04:05.000Z" });
  assert.equal(snapshot.command, OBSERVE_COMMAND);
  assert.equal(snapshot.snapshot_id, snapshotIdFrom("2026-09-02T15:04:05.000Z"));
  assert.equal(snapshot.totals.versions, 2);
  assert.equal(snapshot.totals.performance, 3);
  assert.equal(snapshot.totals.events, 25);
  assert.equal(snapshot.versions[0].app_version, "1.2.1");
  assert.equal(snapshot.versions[0].platform, "IOS");
  assert.equal(snapshot.versions[0].event_count, 20);
  assert.equal(snapshot.versions[0].percentage, 80);
  assert.equal(snapshot.performance[0].metric_name, "expo.app_startup.cold_launch_time");
  assert.equal(snapshot.performance[0].metric_value, 0.8);
  assert.equal(snapshot.performance[0].metric_value_p90, 1.4);
  assert.equal(snapshot.performance[0].build_number, "18");
  assert.equal(snapshot.performance[0].runtime_version, null);
  assert.equal(versionDedupKey(snapshot.versions[0]), "2026-09-02T15|IOS|1.2.1");
  assert.equal(
    performanceDedupKey(snapshot.performance[0]),
    "2026-09-02T15|IOS|1.2.1|expo.app_startup.cold_launch_time",
  );
});

test("sample mascarado não expõe update ids completos nem raw_metadata", () => {
  const snapshot = buildObserveSnapshot(sample, { collectedAt: "2026-09-02T15:04:05.000Z" });
  const masked = maskObserveSample(snapshot.versions[0]);
  assert.equal(masked.update_ids[0], "aaaa…eeee");
  assert.deepEqual(masked.raw_metadata, { keys: ["metrics"] });
});
