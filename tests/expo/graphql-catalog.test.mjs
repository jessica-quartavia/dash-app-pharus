import assert from "node:assert/strict";
import test from "node:test";
import { deriveRuntimes, mapGraphqlChannels, mapGraphqlDeployments } from "../../lib/expo/graphql-catalog.mjs";

test("channels GraphQL preservam production/preview/development e runtimes dos updates", () => {
  const rows = mapGraphqlChannels({
    app: {
      byId: {
        updateChannels: [
          {
            id: "c1",
            name: "production",
            updatedAt: "2026-09-01",
            updateBranches: [{ id: "b1", name: "main", updates: [{ runtimeVersion: "1.2.1" }, { runtimeVersion: "1.2.1" }] }],
          },
          { id: "c2", name: "preview", updatedAt: "2026-08-20", updateBranches: [] },
          { id: "c3", name: "development", updatedAt: "2026-08-01", updateBranches: [] },
        ],
      },
    },
  });
  assert.deepEqual(rows.map((row) => row.name), ["production", "preview", "development"]);
  assert.deepEqual(rows[0].branches[0].runtimeVersions, ["1.2.1"]);
});

test("deployments GraphQL viram channel + runtime sem fingir unique users", () => {
  const rows = mapGraphqlDeployments({
    app: {
      byId: {
        deployments: [
          { id: "d1", channelName: "production", runtimeVersion: "1.2.1", mostRecentlyUpdatedAt: "2026-09-01" },
        ],
      },
    },
  });
  assert.equal(rows[0].channel, "production");
  assert.equal(rows[0].runtimeVersion, "1.2.1");
});

test("deriveRuntimes une channels e deployments sem duplicar", () => {
  const rows = deriveRuntimes({
    channels: [{ id: "c1", name: "production", branches: [{ id: "b1", name: "main", runtimeVersions: ["1.2.1"] }] }],
    deployments: [{ id: "d1", channel: "production", runtimeVersion: "1.2.1", updatedAt: "2026-09-01" }],
    updates: [],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].channel, "production");
  assert.equal(rows[0].runtimeVersion, "1.2.1");
  assert.equal(rows[0].branch, "main");
});
