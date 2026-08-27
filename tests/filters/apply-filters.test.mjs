import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterClients, matchesSearch } from "../../js/lib/filters/apply.mjs";

const sample = [
  {
    id: "PH-1",
    name: "Ana Souza",
    email: "ana@email.com",
    status: "Ativo",
    advisor: "Mariana Costa",
    lastActivityAt: "2026-08-10",
    registeredAt: "2024-01-01",
    hasOpenFinance: true,
    hasMechanisms: false,
    hasWealth: true,
    journeyStage: "Mecanismos",
  },
];

describe("filters", () => {
  it("busca por nome, código ou e-mail", () => {
    assert.equal(matchesSearch(sample[0], "PH-1"), true);
    assert.equal(matchesSearch(sample[0], "souza"), true);
    assert.equal(matchesSearch(sample[0], "xyz"), false);
  });

  it("filtra Open Finance e mecanismos", () => {
    const withOf = filterClients(sample, { openFinance: "yes", period: "all" });
    const withMech = filterClients(sample, { hasMechanisms: "yes", period: "all" });
    assert.equal(withOf.length, 1);
    assert.equal(withMech.length, 0);
  });

  it("filtra segmento e advisor por ID", () => {
    const rows = [
      {
        id: "1",
        name: "Ana",
        email: "a@x.com",
        advisorId: "ep-9",
        tier: "Tier 2",
        registeredAt: "2024-01-01",
        hasOpenFinance: false,
        hasMechanisms: true,
        hasWealth: false,
      },
    ];
    assert.equal(filterClients(rows, { period: "all", segment: "Tier 2" }).length, 1);
    assert.equal(filterClients(rows, { period: "all", segment: "Tier 1" }).length, 0);
    assert.equal(filterClients(rows, { period: "all", advisor: "ep-9" }).length, 1);
    assert.equal(filterClients(rows, { period: "all", advisor: "ep-x" }).length, 0);
  });
});
