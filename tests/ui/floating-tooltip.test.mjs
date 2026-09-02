import assert from "node:assert/strict";
import test from "node:test";
import { computeTooltipPosition } from "../../js/components/floating-tooltip.mjs";

test("tooltip fica acima do ponto quando há espaço", () => {
  const position = computeTooltipPosition({
    anchor: { left: 200, top: 180, right: 212, bottom: 192, width: 12, height: 12 },
    tooltipWidth: 160,
    tooltipHeight: 48,
    viewportWidth: 1200,
    viewportHeight: 800,
  });
  assert.equal(position.placement, "top");
  assert.ok(position.top + 48 <= 180);
  assert.ok(position.left >= 8);
});

test("tooltip abre abaixo quando o ponto está no topo", () => {
  const position = computeTooltipPosition({
    anchor: { left: 200, top: 10, right: 212, bottom: 22, width: 12, height: 12 },
    tooltipWidth: 160,
    tooltipHeight: 48,
    viewportWidth: 1200,
    viewportHeight: 800,
  });
  assert.equal(position.placement, "bottom");
  assert.ok(position.top >= 22);
});

test("tooltip recua da borda direita", () => {
  const position = computeTooltipPosition({
    anchor: { left: 1180, top: 300, right: 1192, bottom: 312, width: 12, height: 12 },
    tooltipWidth: 180,
    tooltipHeight: 40,
    viewportWidth: 1200,
    viewportHeight: 800,
  });
  assert.ok(position.left + 180 <= 1200 - 8);
  assert.ok(position.left >= 8);
});
