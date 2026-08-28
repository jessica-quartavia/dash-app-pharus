import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  EXPANDABLE_CHART_LIMIT,
  expandableChartViewModel,
  renderExpandableChartList,
} from "../../js/components/expandable-chart-list.mjs";
import { hBars } from "../../js/components/charts.mjs";

const ROOT = resolve(import.meta.dirname, "../..");

describe("lista categórica expansível", () => {
  it("mostra inicialmente no máximo oito itens", () => {
    const state = expandableChartViewModel(15);
    assert.equal(EXPANDABLE_CHART_LIMIT, 8);
    assert.equal(state.visibleCount, 8);
    assert.equal(state.hiddenCount, 7);
    assert.equal(state.expanded, false);
  });

  it("expande todos os itens e recolhe novamente para oito", () => {
    const expanded = expandableChartViewModel(15, true);
    const collapsed = expandableChartViewModel(15, false);
    assert.equal(expanded.visibleCount, 15);
    assert.equal(expanded.hiddenCount, 0);
    assert.equal(collapsed.visibleCount, 8);
    assert.equal(collapsed.hiddenCount, 7);
  });

  it("renderiza controle somente quando o limite é excedido", () => {
    const longHtml = renderExpandableChartList(Array.from({ length: 10 }, (_, index) => `<span>${index}</span>`));
    const shortHtml = renderExpandableChartList(Array.from({ length: 8 }, (_, index) => `<span>${index}</span>`));
    assert.match(longHtml, /Ver mais \(2\)/);
    assert.match(longHtml, /8 visíveis de 10/);
    assert.equal((longHtml.match(/data-expandable-item/g) || []).length, 10);
    assert.doesNotMatch(shortHtml, /data-expandable-toggle/);
  });

  it("mantém todas as categorias e métricas no gráfico ao recolher", () => {
    const institutions = Array.from({ length: 15 }, (_, index) => ({
      label: `Instituição ${index + 1}`,
      count: 15 - index,
      percent: ((15 - index) / 120) * 100,
    }));
    const html = hBars(institutions);
    assert.equal((html.match(/class="hbar"/g) || []).length, 15);
    assert.equal((html.match(/data-expandable-item hidden/g) || []).length, 7);
    assert.match(html, /Instituição 15/);
    assert.match(html, /Ver mais \(7\)/);
  });

  it("usa o offset global do header e uma hierarquia de camadas consistente", () => {
    const styles = readFileSync(resolve(ROOT, "css/styles.css"), "utf8");
    const layout = readFileSync(resolve(ROOT, "css/layout.css"), "utf8");
    const components = readFileSync(resolve(ROOT, "css/components.css"), "utf8");
    assert.match(styles, /--app-header-height:\s*68px/);
    assert.match(layout, /z-index:\s*var\(--z-header\)/);
    assert.match(components, /top:\s*calc\(var\(--app-header-height\) \+ var\(--space-1\)\)/);
    assert.match(components, /z-index:\s*var\(--z-filter-sticky\)/);
  });
});
