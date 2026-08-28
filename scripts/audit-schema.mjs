/**
 * Auditoria somente leitura: disponibilidade, contagem e colunas das fontes do dashboard.
 * Não imprime linhas, credenciais ou dados pessoais.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { dataRestFetch } from "../lib/data/pharus-rest.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(root);

const sources = {
  core: [
    "personal_info", "pre_registrations", "user_progress", "connections", "accounts",
    "user_mechanisms", "mechanisms", "form_submissions", "forms", "form_questions",
    "form_answers", "scheduled_meetings", "meetings", "meeting_outputs",
    "scheduled_meeting_evaluation", "meeting_quality_dimension", "advisor_meeting_binding",
    "equities", "fixed_income", "investment_funds", "private_pensions", "other_investments",
    "real_estate_assets", "movable_assets", "consortia", "financings", "loans",
    "transactions", "transaction_types", "transaction_categories", "user_payments",
    "vw_form_questions_answers", "vw_clientes_pagamento_total",
  ],
  backoffice: ["advisors", "advisor_clients"],
  metrics: ["v_current_stage", "events"],
};

const report = {};
for (const [schema, tables] of Object.entries(sources)) {
  report[schema] = {};
  for (const table of tables) {
    try {
      const page = await dataRestFetch(table, { schema, select: "*", limit: 1, countExact: true });
      report[schema][table] = {
        http: page.status,
        rows: page.total,
        columns: page.ok && page.data[0] ? Object.keys(page.data[0]).sort() : [],
        errorCode: page.ok ? null : page.postgrest?.code || `HTTP_${page.status}`,
      };
    } catch (error) {
      report[schema][table] = { http: error?.status || null, rows: null, columns: [], errorCode: error?.code || "request_error" };
    }
  }
}

console.log(JSON.stringify(report, null, 2));
