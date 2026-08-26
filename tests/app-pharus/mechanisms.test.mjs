import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  byCategory,
  byMechanism,
  catalogFromRow,
  clientMechanismsLists,
  isImplementedMechanism,
  lastImplementedAt,
  officialImplementedPairs,
  officialImplementedUserIds,
  uniqueImplementedRecords,
} from "../../lib/app-pharus/mechanisms.mjs";
import { presentMechanismsPage } from "../../lib/app-pharus/present-mechanisms.mjs";
import { formatKpiValue } from "../../js/lib/kpi-value.mjs";
import { defaultMechanismsTableState, sortMechanismRows } from "../../js/lib/mechanisms-table.mjs";
import { paginateRows } from "../../js/components/table-pagination.mjs";
import { formatPercent } from "../../js/utils/format.mjs";
import { PAGE_FILTERS } from "../../js/lib/filters/contracts.mjs";

describe("mecanismos implementados", () => {
  it("trata suggested como implementado internamente", () => {
    assert.equal(isImplementedMechanism({ status: "suggested" }), true);
    assert.equal(isImplementedMechanism({ status: "SUGGESTED" }), true);
    assert.equal(isImplementedMechanism({ status: "draft" }), false);
  });

  it("conta clientes oficiais e evita duplicar o mesmo mecanismo", () => {
    const official = new Set(["a", "b"]);
    const rows = [
      { user_id: "a", mechanism_id: "m1", status: "suggested" },
      { user_id: "a", mechanism_id: "m1", status: "suggested" },
      { user_id: "a", mechanism_id: "m2", status: "suggested" },
      { user_id: "b", mechanism_id: "m1", status: "draft" },
      { user_id: "c", mechanism_id: "m1", status: "suggested" },
    ];
    assert.equal(officialImplementedUserIds(rows, official).size, 1);
    assert.equal(officialImplementedPairs(rows, official).size, 2);
    assert.equal(uniqueImplementedRecords(rows, official).length, 2);
  });

  it("lê nome, categoria e descrição do catálogo", () => {
    const item = catalogFromRow({
      id: "serial-auction",
      data: { name: "Leilão Serial", category: "Ganho de Capital", description: "Arrematação coletiva." },
    });
    assert.equal(item.name, "Leilão Serial");
    assert.equal(item.category, "Ganho de Capital");
    assert.equal(item.description, "Arrematação coletiva.");
  });

  it("monta lista por cliente ordenada do mais recente ao mais antigo", () => {
    const lists = clientMechanismsLists(
      [
        { user_id: "u1", mechanism_id: "m1", created_at: "2026-06-01T00:00:00.000Z" },
        { user_id: "u1", mechanism_id: "m2", created_at: "2026-08-01T00:00:00.000Z" },
      ],
      [{ id: "m1", name: "A", category: "Cat", description: null }, { id: "m2", name: "B", category: "Cat", description: null }],
    );
    assert.equal(lists.get("u1").length, 2);
    assert.equal(lists.get("u1")[0].name, "B");
  });
});

describe("página Mecanismos — números oficiais", () => {
  const catalog = Array.from({ length: 11 }, (_, i) => ({
    id: `m${i}`,
    name: `Mecanismo ${i}`,
    category: i < 6 ? "Recebíveis" : "Ganho de Capital",
    description: null,
  }));
  const implementations = [];
  for (let i = 0; i < 74; i += 1) {
    const n = i < 7 ? 7 : 6;
    for (let m = 0; m < n; m += 1) {
      implementations.push({
        user_id: `u${i}`,
        mechanism_id: `m${m}`,
        created_at: `2026-08-${String((i % 20) + 1).padStart(2, "0")}T12:00:00.000Z`,
      });
    }
  }
  const clients = Array.from({ length: 400 }, (_, i) => ({
    id: `u${i}`,
    name: `Cliente ${i}`,
    email: `u${i}@email.com`,
    registeredAt: "2026-06-01",
    hasMechanisms: i < 74,
    mechanismsImplemented: i < 7 ? 7 : i < 74 ? 6 : 0,
    mechanisms: i < 74 ? Array.from({ length: i < 7 ? 7 : 6 }, (_, m) => ({ name: `Mecanismo ${m}` })) : [],
  }));
  const payload = {
    catalog,
    implementations,
    clients,
    populationTotal: 400,
    methodology: "Mecanismos implementados na base oficial do App Pharus.",
  };

  it("bate 400 / 74 / 326 / 451 / 18,5% sem filtros", () => {
    const page = presentMechanismsPage(payload, { period: "all" });
    const byKey = Object.fromEntries(page.kpis.map((kpi) => [kpi.key, kpi]));
    assert.equal(byKey.with.value, 74);
    assert.equal(byKey.with.primary, true);
    assert.equal(page.kpis[0].key, "with");
    assert.equal(byKey.available.value, 11);
    assert.equal(byKey.implementations.value, 451);
    assert.equal(byKey.without.value, 326);
    assert.equal(Number(byKey.coverage.value.toFixed(1)), 18.5);
    assert.equal(formatPercent(byKey.coverage.value), "18,5%");
    assert.equal(formatKpiValue(byKey.coverage), "18,5%");
    assert.equal(byKey.average.value, 6);
    assert.match(byKey.average.note, /Média entre clientes com mecanismos/);
    assert.equal(page.qtyDist.find((item) => item.label === "0").count, 326);
    assert.equal(page.qtyDist.find((item) => item.label === "5 ou mais").count, 74);
    assert.equal(page.recorteTotal, 400);
    assert.doesNotMatch(JSON.stringify(page.kpis), /suggested|sugerid|Regra pendente|% de implementação|Mediana/i);
  });

  it("conta clientes distintos por mecanismo e implementações por categoria", () => {
    const records = uniqueImplementedRecords(
      implementations.map((row) => ({ ...row, status: "suggested" })),
      new Set(clients.map((c) => c.id)),
    );
    const top = byMechanism(records, catalog, 400);
    assert.equal(top[0].count, 74);
    const cats = byCategory(records, catalog);
    assert.equal(cats.reduce((acc, item) => acc + item.count, 0), 451);
  });

  it("usa a data mais recente como último implementado", () => {
    assert.equal(
      lastImplementedAt([
        { created_at: "2026-07-01T00:00:00.000Z" },
        { created_at: "2026-08-20T12:00:00.000Z" },
      ]),
      "2026-08-20T12:00:00.000Z",
    );
  });

  it("ordena clientes por implementados desc por padrão", () => {
    const page = presentMechanismsPage(payload, { period: "all" });
    assert.equal(page.rows[0].mechanismsImplemented, 7);
    assert.equal(page.rows[73].mechanismsImplemented, 6);
    assert.equal(page.rows[74].mechanismsImplemented, 0);
  });
});

describe("tabela de mecanismos", () => {
  it("pagina 25 clientes por padrão", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ id: `u${i}`, name: `C${i}`, mechanismsImplemented: i }));
    const page = paginateRows(rows, { page: 1, pageSize: 25 });
    assert.equal(page.rows.length, 25);
    assert.equal(page.total, 40);
  });

  it("ordena por implementados desc", () => {
    const rows = [
      { id: "a", name: "A", mechanismsImplemented: 2 },
      { id: "b", name: "B", mechanismsImplemented: 9 },
    ];
    const sorted = sortMechanismRows(rows, "mechanismsImplemented", "desc");
    assert.equal(sorted[0].id, "b");
  });

  it("estado inicial usa implementados desc e 25 por página", () => {
    const state = defaultMechanismsTableState();
    assert.equal(state.pageSize, 25);
    assert.equal(state.sortKey, "mechanismsImplemented");
    assert.equal(state.sortDir, "desc");
  });
});

describe("filtros de mecanismos", () => {
  it("não exibe Possui mecanismos e mantém Período e Responsável / EP", () => {
    const clientes = PAGE_FILTERS().clientes.find((field) => field.key === "hasMechanisms");
    const mecanismos = PAGE_FILTERS().mecanismos;
    assert.equal(clientes.label, "Possui mecanismos");
    assert.equal(mecanismos.some((field) => field.key === "hasMechanisms"), false);
    assert.equal(mecanismos.some((field) => field.key === "period"), true);
    assert.equal(mecanismos.some((field) => field.key === "advisor"), true);
  });
});
