import { PHARUS_DATA_PROJECT } from "./clients.mjs";

export function kpiAudit({
  kpi,
  project = PHARUS_DATA_PROJECT,
  schema = "core",
  tables,
  key,
  rows,
  distinct,
  rule,
  result,
  total,
  coverage,
  status,
}) {
  return {
    kpi,
    project,
    schema,
    tables,
    key,
    rows,
    distinct,
    rule,
    result,
    total,
    coverage: coverage == null ? null : Number(coverage),
    status,
  };
}

export function logKpiAudit(entry) {
  const coverage =
    entry.coverage == null || Number.isNaN(Number(entry.coverage))
      ? "—"
      : `${Number(entry.coverage).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  console.info(
    [
      "[overview-debug]",
      `KPI: ${entry.kpi}`,
      `Projeto: ${entry.project}`,
      `Schema: ${entry.schema}`,
      `Tabela(s): ${entry.tables}`,
      `Chave: ${entry.key}`,
      `Linhas brutas: ${entry.rows ?? "—"}`,
      `Usuários distintos: ${entry.distinct ?? "—"}`,
      `Regra aplicada: ${entry.rule}`,
      `Resultado final: ${entry.result ?? "—"}`,
      `Total de clientes: ${entry.total ?? "—"}`,
      `Cobertura: ${coverage}`,
      `Status da regra: ${entry.status}`,
    ].join("\n"),
  );
}
