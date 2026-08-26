import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { renderFilterBar } from "../../js/components/filter-bar.mjs";
import { nextDraftAfterDayClick } from "../../js/components/date-range-picker.mjs";
import { computePopoverPosition } from "../../js/components/overlay-root.mjs";
import {
  applyPeriodPreset,
  emptyPeriodRange,
  formatPeriodFieldLabel,
  monthMatrix,
  shiftMonth,
  todayIso,
} from "../../js/lib/filters/period.mjs";
import { defaultFilters, resolvePeriodRange } from "../../js/lib/filters/apply.mjs";
import { periodField } from "../../js/lib/filters/contracts.mjs";

const NOW = new Date("2026-08-26T15:00:00.000-03:00");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("DateRangePicker", () => {
  it("primeiro clique define início e o segundo o fim", () => {
    let draft = { period: "all", startDate: null, endDate: null, hover: "" };
    draft = nextDraftAfterDayClick(draft, "2026-08-01", NOW).draft;
    assert.equal(draft.startDate, "2026-08-01");
    assert.equal(draft.endDate, null);
    draft = nextDraftAfterDayClick(draft, "2026-08-26", NOW).draft;
    assert.equal(draft.startDate, "2026-08-01");
    assert.equal(draft.endDate, "2026-08-26");
  });

  it("fim anterior ao início inverte o intervalo", () => {
    let draft = { period: "custom", startDate: "2026-08-15", endDate: null, hover: "" };
    draft = nextDraftAfterDayClick(draft, "2026-08-10", NOW).draft;
    assert.equal(draft.startDate, "2026-08-10");
    assert.equal(draft.endDate, "2026-08-15");
  });

  it("mesmo dia gera intervalo de um dia", () => {
    let draft = { period: "custom", startDate: "2026-08-10", endDate: null, hover: "" };
    draft = nextDraftAfterDayClick(draft, "2026-08-10", NOW).draft;
    assert.equal(draft.startDate, "2026-08-10");
    assert.equal(draft.endDate, "2026-08-10");
  });

  it("navega entre meses", () => {
    assert.deepEqual(shiftMonth(2026, 8, -1), { year: 2026, month: 7 });
    assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  });

  it("semana começa na segunda", () => {
    const cells = monthMatrix(2026, 8, NOW);
    const first = cells.find((cell) => cell.inMonth);
    assert.equal(first.iso, "2026-08-01");
    assert.equal(cells[0].inMonth, false);
    assert.equal(cells[5].iso, "2026-08-01");
  });

  it("Todo o período zera as datas", () => {
    const range = applyPeriodPreset("all", NOW);
    assert.deepEqual(range, emptyPeriodRange());
    assert.equal(formatPeriodFieldLabel(range, NOW), "Todo o período");
  });

  it("atalhos preenchem startDate e endDate", () => {
    const last30 = applyPeriodPreset("last_30", NOW);
    assert.equal(last30.period, "last_30");
    assert.equal(last30.endDate, todayIso(NOW));
    assert.equal(last30.startDate, "2026-07-27");
    assert.equal(formatPeriodFieldLabel(last30, NOW), "Últimos 30 dias");
    const year = applyPeriodPreset("this_year", NOW);
    assert.equal(year.startDate, "2026-01-01");
    assert.equal(year.endDate, todayIso(NOW));
  });

  it("Limpar volta para Todo o período", () => {
    assert.deepEqual(emptyPeriodRange(), { period: "all", startDate: null, endDate: null });
  });

  it("campo fechado usa formato brasileiro no intervalo customizado", () => {
    assert.equal(
      formatPeriodFieldLabel({ period: "custom", startDate: "2026-08-01", endDate: "2026-08-26" }, NOW),
      "01/08/2026 – 26/08/2026",
    );
  });

  it("Aplicar devolve startDate/endDate; fechar sem aplicar não muda o aplicado", () => {
    const applied = { period: "custom", startDate: "2026-08-01", endDate: "2026-08-10" };
    let draft = nextDraftAfterDayClick({ ...applied, endDate: null, hover: "" }, "2026-08-20", NOW).draft;
    assert.equal(draft.endDate, "2026-08-20");
    const discarded = applied;
    assert.equal(discarded.endDate, "2026-08-10");
  });

  it("popover mobile vira sheet; desktop alinha ao campo", () => {
    const mobile = computePopoverPosition({
      anchorRect: { top: 80, bottom: 120, left: 16, right: 200 },
      popoverWidth: 320,
      popoverHeight: 420,
      viewportWidth: 390,
      viewportHeight: 800,
    });
    assert.equal(mobile.mode, "mobile");
    const desktop = computePopoverPosition({
      anchorRect: { top: 80, bottom: 120, left: 40, right: 240 },
      popoverWidth: 320,
      popoverHeight: 420,
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    assert.equal(desktop.mode, "desktop");
    assert.equal(desktop.top, 128);
  });

  it("filter bar usa DateRangePicker e remove DE/ATÉ", () => {
    const html = renderFilterBar({
      fields: [periodField()],
      filters: defaultFilters(),
    });
    assert.match(html, /date-range-picker/);
    assert.match(html, /data-drp-trigger/);
    assert.match(html, /Todo o período/);
    assert.doesNotMatch(html, /type="date"/);
    assert.doesNotMatch(html, />De</);
    assert.doesNotMatch(html, />Até</);
  });

  it("resolvePeriodRange expõe startDate/endDate nulos no período completo", () => {
    const range = resolvePeriodRange(defaultFilters(), NOW);
    assert.equal(range.startDate, null);
    assert.equal(range.endDate, null);
    assert.equal(range.invalid, false);
  });

  it("CSS destaca intervalo, hoje e dias fora do mês", () => {
    const css = readFileSync(resolve(ROOT, "css/components.css"), "utf8");
    assert.match(css, /\.drp-day\.is-selected/);
    assert.match(css, /\.drp-day\.is-edge/);
    assert.match(css, /\.drp-day\.is-today/);
    assert.match(css, /\.drp-day-empty/);
    assert.match(css, /\.drp-popover\[hidden\]/);
    assert.match(css, /\.drp-value[\s\S]*text-overflow:\s*ellipsis/);
  });
});
