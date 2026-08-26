import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const parsed = {};
  for (const line of readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

export function loadProjectEnv(root) {
  const merged = {
    ...parseEnvFile(join(root, ".env")),
    ...parseEnvFile(join(root, ".env.local")),
  };
  for (const [key, value] of Object.entries(merged)) {
    if (!String(process.env[key] || "").trim()) process.env[key] = value;
  }
  return merged;
}
