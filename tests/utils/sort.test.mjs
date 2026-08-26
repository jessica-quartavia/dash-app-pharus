import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortDistributionUnknownLast } from "../../js/utils/sort.mjs";

describe("sortDistributionUnknownLast", () => {
  it("mantém Não informado por último", () => {
    const sorted = sortDistributionUnknownLast([
      { label: "Não informado", count: 9 },
      { label: "Moradia", count: 4 },
      { label: "Lazer", count: 6 },
    ]);
    assert.equal(sorted.at(-1).label, "Não informado");
    assert.equal(sorted[0].label, "Lazer");
  });
});
