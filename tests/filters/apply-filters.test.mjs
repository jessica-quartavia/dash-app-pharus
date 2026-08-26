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
});
