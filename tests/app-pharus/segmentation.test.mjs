import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyClientTier, tierDistribution } from "../../lib/app-pharus/segmentation.mjs";

describe("segmentação Tier", () => {
  it("Tier 1 tem prioridade sobre Tier 4 por reserva", () => {
    const result = classifyClientTier({ income: 10_000, reserve: 700_000, contribution: null });
    assert.equal(result.tier, "Tier 1");
    assert.match(result.tierReasons.join(" "), /Reserva/);
  });

  it("classifica Tier 2, 3 e 4 sem sobreposição", () => {
    assert.equal(classifyClientTier({ income: 60_000 }).tier, "Tier 2");
    assert.equal(classifyClientTier({ income: 30_000 }).tier, "Tier 3");
    assert.equal(classifyClientTier({ income: 10_000 }).tier, "Tier 4");
  });

  it("marca Dados insuficientes sem transformar null em zero", () => {
    assert.equal(classifyClientTier({ income: null, reserve: null, contribution: null }).tier, "Dados insuficientes");
  });

  it("Tier 1 por aporte", () => {
    const result = classifyClientTier({ income: null, reserve: null, contribution: 35_000 });
    assert.equal(result.tier, "Tier 1");
    assert.match(result.tierReasons.join(" "), /Aporte/);
  });

  it("distribui percentuais sobre o recorte", () => {
    const chart = tierDistribution([
      { tier: "Tier 1" },
      { tier: "Tier 1" },
      { tier: "Tier 4" },
    ]);
    const t1 = chart.find((item) => item.label === "Tier 1");
    const t4 = chart.find((item) => item.label === "Tier 4");
    assert.equal(t1.count, 2);
    assert.equal(t1.percent, 66.7);
    assert.equal(t4.count, 1);
    assert.equal(t4.percent, 33.3);
  });
});
