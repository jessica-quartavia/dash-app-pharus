import assert from "node:assert/strict";
import test from "node:test";
import { loadingState } from "../../js/components/loading-state.mjs";
import { skeletonChart, skeletonKpiGrid, skeletonPage, skeletonTable } from "../../js/components/skeleton.mjs";

test("skeleton reutilizável cobre KPI, gráfico e tabela", () => {
  assert.match(skeletonKpiGrid({ count: 3, featured: true }), /ui-skeleton-value/);
  assert.match(skeletonChart({ height: 320 }), /min-height:320px/);
  assert.match(skeletonTable({ rows: 4 }), /ui-skeleton-table/);
  assert.match(skeletonPage(), /page-loading-shell/);
});

test("loading da página usa skeleton em vez de caixa única", () => {
  const html = loadingState();
  assert.match(html, /page-loading-shell/);
  assert.match(html, /ui-skeleton/);
  assert.doesNotMatch(html, /gd-status/);
});
