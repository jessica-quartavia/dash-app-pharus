import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(ROOT);

const URL_BASE = String(process.env.DATA_SUPABASE_URL || process.env.PHARUS_SUPABASE_URL || "").trim().replace(/\/$/, "");
const KEY = String(process.env.DATA_SUPABASE_ANON_KEY || process.env.PHARUS_SUPABASE_ANON_KEY || "").trim();

function headers(schema = "core", extra = {}) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: "application/json",
    "Accept-Profile": schema,
    ...extra,
  };
}

async function fetchAll(table, select, schema = "core") {
  const rows = [];
  let offset = 0;
  while (offset < 200000) {
    const endpoint = new URL(`/rest/v1/${table}`, URL_BASE);
    endpoint.searchParams.set("select", select);
    endpoint.searchParams.set("limit", "1000");
    endpoint.searchParams.set("offset", String(offset));
    const res = await fetch(endpoint, { headers: headers(schema) });
    if (!res.ok) return { ok: false, status: res.status, body: (await res.text()).slice(0, 240), rows };
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return { ok: true, status: 200, rows };
}

async function count(table, schema = "core", extra = "") {
  const endpoint = new URL(`/rest/v1/${table}`, URL_BASE);
  endpoint.searchParams.set("select", "*");
  const url = extra ? `${endpoint}&${extra}` : String(endpoint);
  const res = await fetch(url, {
    headers: headers(schema, { Prefer: "count=exact", Range: "0-0" }),
  });
  const range = res.headers.get("content-range") || "";
  const total = Number((range.match(/\/(\d+)\s*$/) || [])[1] || NaN);
  return { status: res.status, total: Number.isFinite(total) ? total : null };
}

const extraTables = [
  ["core", "mechanisms"],
  ["core", "form_questions"],
  ["core", "form_answers"],
  ["core", "vw_form_questions_answers"],
  ["core", "vw_clientes_pagamento_total"],
  ["core", "library_contents"],
  ["core", "transaction_types"],
  ["core", "transaction_categories"],
  ["core", "transactions"],
  ["core", "pluggy_webhook_delivery"],
  ["core", "account_pluggy_aliases"],
  ["core", "advisor_meeting_binding"],
  ["core", "advisor_calendly_event_type_snapshot"],
  ["core", "calendly_webhook_delivery"],
  ["core", "scheduled_meeting_evaluation"],
  ["core", "scheduling_booking_audit"],
  ["core", "meeting_quality_dimension"],
  ["metrics", "events"],
  ["public", "users"],
];

const extra = {};
for (const [schema, table] of extraTables) {
  extra[`${schema}.${table}`] = await count(table, schema);
}

const mechanisms = await fetchAll("user_mechanisms", "id,user_id,mechanism_id,status,created_at");
const catalog = await fetchAll("mechanisms", "*");

const statusCounts = {};
const usersByStatus = {};
const allUsers = new Set();
for (const row of mechanisms.rows || []) {
  const status = row.status || "null";
  statusCounts[status] = (statusCounts[status] || 0) + 1;
  usersByStatus[status] ||= new Set();
  if (row.user_id) {
    allUsers.add(row.user_id);
    usersByStatus[status].add(row.user_id);
  }
}

const openapi = await fetch(new URL("/rest/v1/", URL_BASE), {
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: "application/openapi+json",
    "Accept-Profile": "core",
  },
});
const spec = openapi.ok ? await openapi.json() : { error: openapi.status };
const paths = spec.paths ? Object.keys(spec.paths).sort() : [];

console.log(JSON.stringify({
  host: new URL(URL_BASE).host,
  extraCounts: extra,
  userMechanisms: {
    rows: mechanisms.rows?.length || 0,
    distinctUsers: allUsers.size,
    statusRowCounts: statusCounts,
    statusDistinctUsers: Object.fromEntries(
      Object.entries(usersByStatus).map(([k, set]) => [k, set.size]),
    ),
  },
  mechanismCatalog: {
    http: catalog.status,
    rows: catalog.rows?.length || 0,
    sample: (catalog.rows || []).slice(0, 5),
    columns: catalog.rows?.[0] ? Object.keys(catalog.rows[0]) : [],
  },
  openapiPaths: paths,
  envHasDataUrl: Boolean(process.env.DATA_SUPABASE_URL || process.env.PHARUS_SUPABASE_URL),
  envHasDataServiceRole: Boolean(
    process.env.DATA_SUPABASE_SERVICE_ROLE_KEY || process.env.PHARUS_SUPABASE_SERVICE_ROLE_KEY,
  ),
}, null, 2));
