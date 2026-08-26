/**
 * Inspeção read-only do schema core do App Pharus.
 * Não imprime chaves. Uso: node scripts/probe-overview-source.mjs
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(ROOT);

const URL_BASE = String(
  process.env.DATA_SUPABASE_URL || process.env.PHARUS_SUPABASE_URL || "",
).trim().replace(/\/$/, "");
const KEY = String(
  process.env.DATA_SUPABASE_ANON_KEY || process.env.PHARUS_SUPABASE_ANON_KEY || "",
).trim();

if (!URL_BASE || !KEY) {
  console.error("Configure DATA_SUPABASE_URL e DATA_SUPABASE_ANON_KEY.");
  process.exit(1);
}

function headers(schema = "core", { count = false } = {}) {
  const h = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: "application/json",
    "Accept-Profile": schema,
  };
  if (count) {
    h.Prefer = "count=exact";
    h.Range = "0-0";
  }
  return h;
}

async function rest(table, { select = "*", limit = 3, schema = "core", extra = "" } = {}) {
  const endpoint = new URL(`/rest/v1/${table}`, URL_BASE);
  endpoint.searchParams.set("select", select);
  if (limit != null) endpoint.searchParams.set("limit", String(limit));
  const url = extra ? `${endpoint.toString()}&${extra}` : endpoint.toString();
  const res = await fetch(url, { headers: headers(schema) });
  const text = await res.text();
  let data = [];
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 400);
  }
  return { status: res.status, data, range: res.headers.get("content-range") };
}

async function countRows(table, extra = "") {
  const endpoint = new URL(`/rest/v1/${table}`, URL_BASE);
  endpoint.searchParams.set("select", "*");
  const url = extra ? `${endpoint.toString()}&${extra}` : endpoint.toString();
  const res = await fetch(url, { headers: headers("core", { count: true }) });
  const range = res.headers.get("content-range") || "";
  const total = Number((range.match(/\/(\d+)\s*$/) || [])[1] || NaN);
  return { status: res.status, total: Number.isFinite(total) ? total : null, range };
}

async function fetchAllIds(table, column, extra = "") {
  const ids = new Set();
  let offset = 0;
  const pageSize = 1000;
  while (offset < 200000) {
    const endpoint = new URL(`/rest/v1/${table}`, URL_BASE);
    endpoint.searchParams.set("select", column);
    endpoint.searchParams.set("limit", String(pageSize));
    endpoint.searchParams.set("offset", String(offset));
    const url = extra ? `${endpoint.toString()}&${extra}` : endpoint.toString();
    const res = await fetch(url, { headers: headers() });
    const rows = res.ok ? await res.json() : [];
    if (!Array.isArray(rows) || !rows.length) break;
    for (const row of rows) {
      const value = row[column];
      if (value != null && String(value).trim()) ids.add(String(value));
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return ids;
}

const TABLES = [
  "personal_info",
  "pre_registrations",
  "user_progress",
  "connections",
  "accounts",
  "user_mechanisms",
  "user_engines",
  "form_submissions",
  "forms",
  "scheduled_meetings",
  "meetings",
  "meeting_outputs",
  "equities",
  "fixed_income",
  "investment_funds",
  "private_pensions",
  "other_investments",
  "real_estate_assets",
  "movable_assets",
  "consortia",
  "financings",
  "loans",
  "user_payments",
];

const report = {
  host: new URL(URL_BASE).host,
  schema: "core",
  tables: {},
  samples: {},
};

for (const table of TABLES) {
  const counted = await countRows(table);
  const sample = await rest(table, { limit: 2 });
  const keys = Array.isArray(sample.data) && sample.data[0] ? Object.keys(sample.data[0]) : [];
  report.tables[table] = {
    http: counted.status,
    rows: counted.total,
    columns: keys,
    sampleStatus: sample.status,
  };
  if (Array.isArray(sample.data)) {
    report.samples[table] = sample.data.map((row) => {
      const slim = {};
      for (const key of keys) {
        const value = row[key];
        if (value == null) slim[key] = null;
        else if (typeof value === "string" && value.includes("@")) slim[key] = "[email]";
        else if (typeof value === "string" && value.length > 80) slim[key] = `${value.slice(0, 40)}…`;
        else slim[key] = value;
      }
      return slim;
    });
  } else {
    report.samples[table] = sample.data;
  }
}

const distinctTargets = [
  ["personal_info", "user_id"],
  ["pre_registrations", "user_id"],
  ["user_progress", "user_id"],
  ["connections", "user_id"],
  ["accounts", "user_id"],
  ["user_mechanisms", "user_id"],
  ["form_submissions", "user_id"],
  ["scheduled_meetings", "user_id"],
  ["meeting_outputs", "user_id"],
  ["meetings", "user_id"],
  ["equities", "user_id"],
  ["fixed_income", "user_id"],
  ["investment_funds", "user_id"],
  ["private_pensions", "user_id"],
  ["other_investments", "user_id"],
  ["real_estate_assets", "user_id"],
  ["movable_assets", "user_id"],
  ["consortia", "user_id"],
  ["financings", "user_id"],
  ["loans", "user_id"],
];

report.distinct = {};
for (const [table, column] of distinctTargets) {
  if (report.tables[table]?.http !== 200) {
    report.distinct[`${table}.${column}`] = { error: `http ${report.tables[table]?.http}` };
    continue;
  }
  try {
    const ids = await fetchAllIds(table, column);
    report.distinct[`${table}.${column}`] = ids.size;
  } catch (error) {
    report.distinct[`${table}.${column}`] = { error: error instanceof Error ? error.message : String(error) };
  }
}

console.log(JSON.stringify(report, null, 2));
