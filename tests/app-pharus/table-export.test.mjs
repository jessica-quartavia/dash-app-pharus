import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTableState,
  renderInteractiveTablePanel,
  rowsForExport,
} from "../../js/components/interactive-table.mjs";
import { exportPreparedRows } from "../../js/components/table-export.mjs";
import {
  buildCsv,
  buildXlsx,
  canExportRows,
  CSV_DELIMITER,
  csvCell,
  exportFileName,
  formatExportBoolean,
  formatExportDate,
  isXlsxZip,
  parseCsvDataRows,
  resolveExportColumns,
} from "../../js/lib/export-table.mjs";

const CLIENT_COLUMNS = [
  { key: "name", label: "Cliente", sortable: true, value: (row) => `<strong>${row.name}</strong>` },
  { key: "tier", label: "Segmento", sortable: true, value: (row) => row.tier },
  { key: "registeredAt", label: "Data de cadastro", sortable: true, value: (row) => row.registeredAt },
  { key: "hasWealth", label: "Patrimônio", sortable: true, value: (row) => String(row.hasWealth) },
  { key: "actions", label: "Ver", export: false, value: () => "<button>Ver</button>" },
];

const CLIENT_EXPORT_COLUMNS = [
  { key: "name", label: "Cliente", type: "text" },
  { key: "email", label: "E-mail", type: "text" },
  { key: "tier", label: "Segmento", type: "text" },
  { key: "registeredAt", label: "Data de cadastro", type: "date" },
  { key: "hasWealth", label: "Patrimônio", type: "boolean" },
  { key: "hasOpenFinance", label: "Open Finance", type: "boolean" },
  { key: "hasMechanisms", label: "Mecanismos", type: "boolean" },
  { key: "hasMeetings", label: "Reuniões", type: "boolean" },
  { key: "journeyStage", label: "Estágio da jornada", type: "text" },
];

function makeClients(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `c-${index}`,
    name: `Cliente ${String(index).padStart(3, "0")}`,
    email: `cliente${index}@quartavia.com.br`,
    tier: index % 2 ? "Tier 2" : "Tier 1",
    registeredAt: "2026-03-05T12:00:00.000Z",
    hasWealth: index % 3 === 0,
    hasOpenFinance: false,
    hasMechanisms: true,
    hasMeetings: null,
    journeyStage: "Mecanismos",
  }));
}

test("CSV usa UTF-8 BOM, ponto e vírgula e não leva HTML", () => {
  const csv = buildCsv(
    [{ name: "Ana; \"Beta\"", email: "ana@x.com", note: "linha\n2" }],
    [
      { key: "name", label: "Cliente" },
      { key: "email", label: "E-mail" },
      { key: "note", label: "Nota" },
    ],
  );
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv.replace(/^\uFEFF/, ""), /^Cliente;E-mail;Nota/);
  assert.match(csv, /"Ana; ""Beta"""/);
  assert.equal(CSV_DELIMITER, ";");
  assert.doesNotMatch(csv, /<strong>/);
});

test("booleano vira Sim/Não e data fica em DD/MM/YYYY", () => {
  assert.equal(formatExportBoolean(true), "Sim");
  assert.equal(formatExportBoolean(false), "Não");
  assert.equal(formatExportDate("2026-09-11T00:00:00.000Z"), "11/09/2026");
  const row = { hasWealth: true, registeredAt: "2026-03-05T12:00:00.000Z" };
  assert.equal(csvCell(row, { key: "hasWealth", type: "boolean" }), "Sim");
  assert.equal(csvCell(row, { key: "registeredAt", type: "date" }), "05/03/2026");
});

test("paginação de 25 não limita exportação de 423 registros filtrados", async () => {
  const rows = makeClients(423);
  const state = defaultTableState({ sortKey: "name", sortDir: "asc", pageSize: 25, page: 2 });
  const visible = rowsForExport(rows, CLIENT_COLUMNS, state, { hideSearch: true });
  assert.equal(visible.length, 423);
  const csv = buildCsv(visible, CLIENT_EXPORT_COLUMNS);
  assert.equal(parseCsvDataRows(csv).length, 423);
  const xlsx = await buildXlsx(visible, CLIENT_EXPORT_COLUMNS);
  assert.equal(isXlsxZip(xlsx), true);
  const asText = new TextDecoder().decode(xlsx.slice(0, 200));
  assert.match(asText, /^PK/);
  assert.match(new TextDecoder().decode(xlsx), /xl\/worksheets\/sheet1\.xml/);
});

test("filtros, busca e ordenação do recorte são respeitados", () => {
  const rows = [
    { id: "2", name: "Bruno", email: "b@x.com", tier: "Tier 2" },
    { id: "1", name: "Ana", email: "ana@x.com", tier: "Tier 1" },
    { id: "3", name: "Carla", email: "c@x.com", tier: "Tier 1" },
  ];
  const columns = [{ key: "name", label: "Cliente", sortable: true, value: (row) => row.name }];
  const filtered = rows.filter((row) => row.tier === "Tier 1");
  const sorted = rowsForExport(filtered, columns, { sortKey: "name", sortDir: "asc", page: 1, pageSize: 25 }, { hideSearch: true });
  assert.deepEqual(sorted.map((row) => row.name), ["Ana", "Carla"]);
  const searched = rowsForExport(rows, columns, { search: "bru", sortKey: "name", sortDir: "asc" }, { hideSearch: false });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].name, "Bruno");
});

test("recorte vazio e loading não geram arquivo", async () => {
  const columns = [{ key: "name", label: "Cliente" }];
  const empty = await exportPreparedRows({ format: "csv", rows: [], columns, fileSlug: "clientes" });
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "empty");
  const loading = await exportPreparedRows({
    format: "xlsx",
    rows: makeClients(3),
    columns,
    fileSlug: "clientes",
    loading: true,
  });
  assert.equal(loading.ok, false);
  assert.equal(loading.reason, "loading");
  assert.equal(canExportRows([], {}), false);
});

test("coluna de ação fica de fora e o nome do arquivo usa a data atual", () => {
  const resolved = resolveExportColumns(null, CLIENT_COLUMNS);
  assert.equal(resolved.some((col) => col.key === "actions"), false);
  assert.equal(resolved.some((col) => col.key === "name"), true);
  const now = new Date(2026, 8, 11);
  assert.equal(exportFileName("clientes", "csv", now), "pharus-clientes-2026-09-11.csv");
  assert.equal(exportFileName("CSAT", "xlsx", now), "pharus-csat-2026-09-11.xlsx");
});

test("toolbar da tabela expõe CSV/Excel e desabilita no loading", () => {
  const html = renderInteractiveTablePanel({
    rows: makeClients(3),
    columns: CLIENT_COLUMNS,
    state: defaultTableState(),
    title: "3 clientes",
    exportName: "clientes",
    exportColumns: CLIENT_EXPORT_COLUMNS,
  });
  assert.match(html, /Exportar CSV/);
  assert.match(html, /Exportar Excel/);
  assert.match(html, /Exportar todos os registros filtrados em CSV/);
  const loading = renderInteractiveTablePanel({
    rows: makeClients(3),
    columns: CLIENT_COLUMNS,
    state: defaultTableState(),
    exportLoading: true,
  });
  assert.match(loading, /disabled/);
  const empty = renderInteractiveTablePanel({
    rows: [],
    columns: CLIENT_COLUMNS,
    state: defaultTableState(),
  });
  assert.match(empty, /Nenhum dado para exportar/);
});
