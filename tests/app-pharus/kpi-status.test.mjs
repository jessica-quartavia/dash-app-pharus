import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatKpiValue } from "../../js/lib/kpi-value.mjs";

describe("formatKpiValue status", () => {
  it("não inventa número para regra pendente", () => {
    assert.equal(
      formatKpiValue({ status: "pending", value: "Regra pendente" }),
      "Regra pendente",
    );
  });

  it("não inventa número para dado indisponível", () => {
    assert.equal(formatKpiValue({ status: "unavailable" }), "Não disponível");
  });

  it("formata notas com uma casa decimal sem alterar o valor calculado", () => {
    const average = 4.911111111111111;
    assert.equal(formatKpiValue({ kind: "decimal", value: average }), "4,9");
    assert.equal(formatKpiValue({ kind: "decimal", value: 4.95 }), "5,0");
    assert.equal(formatKpiValue({ kind: "decimal", value: 4 }), "4,0");
    assert.equal(average, 4.911111111111111);
  });
});
