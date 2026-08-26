import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { OFFICIAL_CLIENT_RULE } from "../lib/app-pharus/clients.mjs";
import { fetchOfficialUsers } from "../lib/app-pharus/queries.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(ROOT);

const official = await fetchOfficialUsers();
console.log(JSON.stringify({
  source: official.source,
  fetched: official.fetched,
  official: official.rows.length,
  rule: OFFICIAL_CLIENT_RULE.sql,
}, null, 2));
