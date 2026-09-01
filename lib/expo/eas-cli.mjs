/**
 * Execução server-side do EAS CLI com EXPO_TOKEN mapeado de EXPO_ACCESS_TOKEN.
 * Nunca logar o token.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getExpoConfig, getExpoToken } from "./expo-env.mjs";

const EAS_ARGS_PREFIX = ["eas-cli"];

function easEnv() {
  const token = getExpoToken();
  if (!token) return null;
  const env = { ...process.env, EXPO_TOKEN: token };
  delete env.EXPO_ACCESS_TOKEN;
  return env;
}

function stripNpmNoise(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => !/npm warn Unknown env config/.test(line))
    .filter((line) => !/\[DEP0190\] DeprecationWarning/.test(line))
    .filter((line) => !/Use `node --trace-deprecation`/.test(line))
    .join("\n")
    .trim();
}

export function runEas(args, { cwd, timeoutMs = 120_000, expectJson = false } = {}) {
  const env = easEnv();
  if (!env) {
    return { ok: false, code: "missing_token", error: "EXPO_ACCESS_TOKEN não configurado no servidor." };
  }

  const fullArgs = [...EAS_ARGS_PREFIX, ...args];
  let result;
  try {
    result = spawnSync("npx", fullArgs, {
      cwd,
      env,
      encoding: "utf8",
      timeout: timeoutMs,
      shell: process.platform === "win32",
    });
  } catch (error) {
    return {
      ok: false,
      code: "spawn_error",
      error: error instanceof Error ? error.message : "Falha ao executar EAS CLI.",
    };
  }

  const stdout = stripNpmNoise(result.stdout);
  const stderr = stripNpmNoise(result.stderr);
  const combined = `${stdout}\n${stderr}`.trim();

  if (result.error?.code === "ETIMEDOUT") {
    return { ok: false, code: "timeout", error: "EAS CLI excedeu o tempo limite." };
  }

  if (result.status !== 0) {
    const message = stderr || stdout || combined || "Comando EAS falhou.";
    return {
      ok: false,
      code: "eas_command_failed",
      error: message.split("\n").find((line) => line.trim() && !line.startsWith("Error:")) || message,
      exitCode: result.status,
      raw: combined,
    };
  }

  if (expectJson) {
    try {
      const json = JSON.parse(stdout);
      return { ok: true, data: json, raw: stdout };
    } catch {
      return { ok: false, code: "invalid_json", error: "EAS CLI não retornou JSON válido.", raw: stdout };
    }
  }

  return { ok: true, data: stdout, raw: stdout };
}

export async function probeEasAuth() {
  const result = runEas(["account:view", "--non-interactive"]);
  if (!result.ok) {
    return {
      authenticated: false,
      error: result.error,
      code: result.code,
    };
  }

  const text = result.data || "";
  const accountMatch = text.match(/•\s+(\S+)\s+\(Role:\s*([^)]+)\)/);
  const robotMatch = text.match(/^(.+?)\s+\(robot\)/im) || text.match(/^(.+?)\s+\(authenticated using EXPO_TOKEN\)/im);

  return {
    authenticated: /authenticated using EXPO_TOKEN/i.test(text) || Boolean(accountMatch),
    account: accountMatch?.[1] || getExpoConfig().account,
    role: accountMatch?.[2]?.trim() || null,
    actor: robotMatch?.[1]?.trim() || null,
    raw: text,
  };
}

export function createEasWorkspace(projectId) {
  const dir = mkdtempSync(join(tmpdir(), "dash-pharus-eas-"));
  const { account, slug } = getExpoConfig();
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "pharus-eas-probe", private: true, version: "1.0.0" }, null, 2));
  writeFileSync(
    join(dir, "app.json"),
    JSON.stringify(
      {
        expo: {
          name: "Pharus",
          slug,
          owner: account,
          version: "1.0.0",
          extra: { eas: { projectId } },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, "eas.json"), JSON.stringify({ cli: { version: ">= 12.0.0" } }, null, 2));
  return dir;
}

export function viewChannel(projectId, channelName) {
  const cwd = createEasWorkspace(projectId);
  return runEas(["channel:view", channelName, "--json", "--non-interactive"], {
    cwd,
    expectJson: true,
    timeoutMs: 120_000,
  });
}

export function listBuilds(projectId, limit = 10) {
  const cwd = createEasWorkspace(projectId);
  const result = runEas(["build:list", "--json", "--non-interactive", "--limit", String(limit)], {
    cwd,
    expectJson: true,
  });
  if (!result.ok) return result;
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    rows: rows.map((row) => ({
      id: row.id,
      platform: row.platform,
      status: row.status,
      version: row.appVersion || row.appBuildVersion || null,
      channel: row.channel || null,
      runtimeVersion: row.runtimeVersion || null,
      fingerprintHash: row.fingerprint?.hash || null,
      createdAt: row.createdAt || row.completedAt || null,
      completedAt: row.completedAt || null,
    })),
    raw: rows,
  };
}

export function listChannels(projectId, limit = 25) {
  const cwd = createEasWorkspace(projectId);
  const result = runEas(["channel:list", "--json", "--non-interactive", "--limit", String(limit)], {
    cwd,
    expectJson: true,
  });
  if (!result.ok) return result;

  const payload = result.data || {};
  const rows = payload.currentPage || payload.items || (Array.isArray(payload) ? payload : []);
  return {
    ok: true,
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt,
      branches: (row.updateBranches || []).map((branch) => {
        const groups = branch.updateGroups || [];
        const flat = groups.flatMap((group) => (Array.isArray(group) ? group : [group]));
        const runtimeVersions = [
          ...new Set(flat.map((item) => item?.runtime?.version).filter(Boolean)),
        ];
        return {
          id: branch.id,
          name: branch.name,
          runtimeVersion: runtimeVersions[0] || null,
          runtimeVersions,
        };
      }),
    })),
  };
}

export function listUpdateGroups(projectId, limit = 25) {
  const cwd = createEasWorkspace(projectId);
  const result = runEas(["update:list", "--all", "--platform", "all", "--json", "--non-interactive", "--limit", String(limit)], {
    cwd,
    expectJson: true,
    timeoutMs: 120_000,
  });
  if (!result.ok) return result;
  return { ok: true, data: result.data };
}

export function fetchUpdateInsights(projectId, groupId, { days = 30, startDate, endDate } = {}) {
  const cwd = createEasWorkspace(projectId);
  const args = ["update:insights", groupId, "--json", "--non-interactive"];
  if (startDate && endDate) args.push("--start", startDate, "--end", endDate);
  else args.push("--days", String(days));
  return runEas(args, { cwd, expectJson: true, timeoutMs: 180_000 });
}
