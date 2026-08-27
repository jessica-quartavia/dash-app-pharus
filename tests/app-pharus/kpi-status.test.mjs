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
});
