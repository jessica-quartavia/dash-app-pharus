import { expoGraphql } from "./expo-graphql.mjs";

export function mapGraphqlChannels(data) {
  return (data?.app?.byId?.updateChannels || []).map((channel) => {
    const branches = (channel.updateBranches || []).map((branch) => {
      const updates = branch.updates || [];
      const runtimeVersions = [...new Set(updates.map((item) => item.runtimeVersion).filter(Boolean))];
      return {
        id: branch.id,
        name: branch.name,
        runtimeVersion: runtimeVersions[0] || null,
        runtimeVersions,
      };
    });
    return {
      id: channel.id,
      name: channel.name,
      updatedAt: channel.updatedAt,
      branches,
    };
  });
}

export function mapGraphqlDeployments(data) {
  return (data?.app?.byId?.deployments || []).map((row) => ({
    id: row.id,
    channel: row.channelName || row.channel?.name || null,
    runtimeVersion: row.runtimeVersion || null,
    updatedAt: row.mostRecentlyUpdatedAt || null,
  }));
}

export function mapGraphqlUpdates(data) {
  return (data?.app?.byId?.updates || []).map((row) => ({
    id: row.id,
    branch: row.branch?.name || null,
    runtimeVersion: row.runtimeVersion || null,
    platform: row.platform || null,
    updatedAt: row.updatedAt || row.createdAt || null,
    group: row.group || null,
    message: row.message || null,
  }));
}

export function mapGraphqlBuilds(data) {
  return (data?.app?.byId?.builds || []).map((row) => ({
    id: row.id,
    platform: row.platform,
    status: row.status,
    version: row.appVersion || row.appBuildVersion || null,
    channel: row.channel || null,
    runtimeVersion: row.runtimeVersion || null,
    fingerprintHash: null,
    createdAt: row.createdAt || row.completedAt || null,
    completedAt: row.completedAt || null,
  }));
}

export function deriveRuntimes({ channels = [], deployments = [], updates = [] } = {}) {
  const seen = new Set();
  const rows = [];
  const add = (item) => {
    const channel = item.channel || null;
    const branch = item.branch || null;
    const runtimeVersion = item.runtimeVersion || null;
    if (!channel && !runtimeVersion) return;
    const key = `${channel || ""}|${runtimeVersion || ""}`;
    if (seen.has(key)) {
      const index = rows.findIndex((row) => `${row.channel || ""}|${row.runtimeVersion || ""}` === key);
      if (index >= 0 && !rows[index].branch && branch) {
        rows[index] = { ...rows[index], branch, id: item.id || rows[index].id };
      }
      return;
    }
    seen.add(key);
    rows.push({
      id: item.id || key,
      channel,
      branch,
      runtimeVersion,
      updatedAt: item.updatedAt || null,
    });
  };

  for (const row of deployments) add(row);
  for (const channel of channels) {
    const branches = channel.branches || [];
    if (!branches.length) add({ id: channel.id, channel: channel.name, updatedAt: channel.updatedAt });
    for (const branch of branches) {
      const runtimes = branch.runtimeVersions?.length ? branch.runtimeVersions : [branch.runtimeVersion];
      const versions = runtimes.filter(Boolean);
      if (!versions.length) add({ id: `${channel.id}-${branch.id}`, channel: channel.name, branch: branch.name, updatedAt: channel.updatedAt });
      for (const runtimeVersion of versions) {
        add({
          id: `${channel.id}-${branch.id}-${runtimeVersion}`,
          channel: channel.name,
          branch: branch.name,
          runtimeVersion,
          updatedAt: channel.updatedAt,
        });
      }
    }
  }
  for (const row of updates) add(row);
  return rows;
}

export async function fetchGraphqlBuilds(projectId, limit = 15) {
  const result = await expoGraphql(
    `query AppBuilds($appId: String!, $limit: Int!, $offset: Int!) {
      app {
        byId(appId: $appId) {
          builds(offset: $offset, limit: $limit) {
            id
            status
            platform
            createdAt
            completedAt
            appVersion
            appBuildVersion
            runtimeVersion
            channel
          }
        }
      }
    }`,
    { appId: projectId, limit, offset: 0 },
  );
  if (!result.ok) return { ...result, rows: [] };
  return { ok: true, rows: mapGraphqlBuilds(result.data) };
}

export async function fetchGraphqlChannels(projectId, limit = 25) {
  const nested = await expoGraphql(
    `query AppChannels($appId: String!, $limit: Int!, $offset: Int!) {
      app {
        byId(appId: $appId) {
          updateChannels(offset: $offset, limit: $limit) {
            id
            name
            updatedAt
            updateBranches(limit: 10, offset: 0) {
              id
              name
              updates(limit: 5, offset: 0) {
                id
                runtimeVersion
                platform
                createdAt
              }
            }
          }
        }
      }
    }`,
    { appId: projectId, limit, offset: 0 },
  );
  if (nested.ok) return { ok: true, rows: mapGraphqlChannels(nested.data) };

  const simple = await expoGraphql(
    `query AppChannelsSimple($appId: String!, $limit: Int!, $offset: Int!) {
      app {
        byId(appId: $appId) {
          updateChannels(offset: $offset, limit: $limit) {
            id
            name
            updatedAt
          }
        }
      }
    }`,
    { appId: projectId, limit, offset: 0 },
  );
  if (simple.ok) return { ok: true, rows: mapGraphqlChannels(simple.data), degraded: true };
  return { ...nested, rows: [] };
}

export async function fetchGraphqlDeployments(projectId, limit = 25) {
  const result = await expoGraphql(
    `query AppDeployments($appId: String!, $limit: Int!) {
      app {
        byId(appId: $appId) {
          deployments(limit: $limit) {
            id
            channelName
            runtimeVersion
            mostRecentlyUpdatedAt
            channel { id name }
          }
        }
      }
    }`,
    { appId: projectId, limit },
  );
  if (!result.ok) return { ...result, rows: [] };
  return { ok: true, rows: mapGraphqlDeployments(result.data) };
}

export async function fetchGraphqlUpdates(projectId, limit = 25) {
  const result = await expoGraphql(
    `query AppUpdates($appId: String!, $limit: Int!, $offset: Int!) {
      app {
        byId(appId: $appId) {
          updates(limit: $limit, offset: $offset) {
            id
            platform
            runtimeVersion
            createdAt
            updatedAt
            message
            group
            branch { id name }
          }
        }
      }
    }`,
    { appId: projectId, limit, offset: 0 },
  );
  if (!result.ok) return { ...result, rows: [] };
  return { ok: true, rows: mapGraphqlUpdates(result.data) };
}
