import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCurrencyCompact, formatCurrencyExact, formatPercent } from "../../js/utils/format.mjs";
import { monthColumns } from "../../js/components/charts.mjs";

describe("formatação monetária", () => {
  it("abrevia mil, milhão e bilhão em pt-BR", () => {
    assert.equal(formatCurrencyCompact(850), "R$ 850");
    assert.equal(formatCurrencyCompact(12500), "R$ 12,5 mil");
    assert.equal(formatCurrencyCompact(1800000), "R$ 1,8 mi");
    assert.equal(formatCurrencyCompact(2150000), "R$ 2,15 mi");
    assert.equal(formatCurrencyCompact(1_200_000_000), "R$ 1,2 bi");
  });

  it("tooltip usa valor completo", () => {
    assert.match(formatCurrencyExact(2150000), /R\$\s*2\.150\.000,00/);
  });

  it("formata cobertura 18,5% com uma casa decimal", () => {
    assert.equal(formatPercent(18.5), "18,5%");
    assert.equal(formatPercent(100), "100%");
  });
});

describe("evolução patrimonial", () => {
  it("mostra no máximo 6 meses com rótulo abreviado", () => {
    const series = [
      { month: "2025-09", count: 11800000 },
      { month: "2025-10", count: 12150000 },
      { month: "2026-03", count: 13560000 },
      { month: "2026-04", count: 13890000 },
      { month: "2026-05", count: 14120000 },
      { month: "2026-06", count: 14480000 },
      { month: "2026-07", count: 14830000 },
      { month: "2026-08", count: 15170000 },
    ];
    const html = monthColumns(series, { format: "currency", maxItems: 6 });
    assert.match(html, /data-cols="6"/);
    assert.match(html, /R\$ 15,17 mi/);
    assert.match(html, /Patrimônio: /);
    assert.doesNotMatch(html, /11\.800\.000/);
    assert.doesNotMatch(html, /Set\/25/);
  });
});
