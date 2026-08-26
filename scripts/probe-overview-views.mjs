import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(ROOT);

const URL_BASE = String(process.env.DATA_SUPABASE_URL || process.env.PHARUS_SUPABASE_URL || "").trim().replace(/\/$/, "");
const KEY = String(process.env.DATA_SUPABASE_ANON_KEY || process.env.PHARUS_SUPABASE_ANON_KEY || "").trim();

function headers(schema = "core") {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: "application/json",
    "Accept-Profile": schema,
  };
}

async function sample(table, limit = 2, extra = "") {
  const endpoint = new URL(`/rest/v1/${table}`, URL_BASE);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("limit", String(limit));
  const url = extra ? `${endpoint}&${extra}` : String(endpoint);
  const res = await fetch(url, { headers: headers() });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 400); }
  return { status: res.status, data };
}

async function fetchColumn(table, column) {
  const values = [];
  let offset = 0;
  while (offset < 200000) {
    const endpoint = new URL(`/rest/v1/${table}`, URL_BASE);
    endpoint.searchParams.set("select", column);
    endpoint.searchParams.set("limit", "1000");
    endpoint.searchParams.set("offset", String(offset));
    const res = await fetch(endpoint, { headers: headers() });
    if (!res.ok) return { status: res.status, body: (await res.text()).slice(0, 300), values };
    const page = await res.json();
    values.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return { status: 200, values };
}

const formView = await sample("vw_form_questions_answers", 2);
const payView = await sample("vw_clientes_pagamento_total", 2);
const knownUser = "8abf29d5-16a1-4af9-8f9e-32bf71a8025a";
const personalById = await sample("personal_info", 5, `user_id=eq.${knownUser}`);
const progressById = await sample("user_progress", 5, `user_id=eq.${knownUser}`);
const connById = await sample("connections", 5, `user_id=eq.${knownUser}`);
const subById = await sample("form_submissions", 5, `user_id=eq.${knownUser}`);

const formCols = Array.isArray(formView.data) && formView.data[0] ? Object.keys(formView.data[0]) : [];
const formUsers = formCols.includes("user_id") ? await fetchColumn("vw_form_questions_answers", "user_id") : { values: [] };
const distinctFormUsers = new Set((formUsers.values || []).map((r) => r.user_id).filter(Boolean));

console.log(JSON.stringify({
  formView: {
    status: formView.status,
    columns: formCols,
    sample: Array.isArray(formView.data) ? formView.data : formView.data,
  },
  payView,
  lookupKnownUser: { personalById, progressById, connById, subById },
  formDistinctUsers: formUsers.status === 200 ? distinctFormUsers.size : formUsers,
}, null, 2));
