/**
 * DateRangePicker — filtro global de período (draft vs applied).
 */
import { escapeHtml } from "../utils/escape.mjs";
import {
  DATE_RANGE_PRESETS,
  applyPeriodPreset,
  canNavigateToMonth,
  draftHighlight,
  emptyPeriodRange,
  formatPeriodFieldLabel,
  formatIsoDateBr,
  isRangeComplete,
  monthMatrix,
  monthTitle,
  nextDraftAfterDayClick,
  sanitizePeriodFilters,
  shiftMonth,
  todayIso,
} from "../lib/filters/period.mjs";
import {
  ensureOverlayRoot,
  mountPopoverPortal,
  positionAnchoredPopover,
  unmountPopoverPortal,
} from "./overlay-root.mjs";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export { nextDraftAfterDayClick };

function hiddenInput(id, value) {
  return `<input type="hidden" id="${escapeHtml(id)}" value="${escapeHtml(value || "")}" />`;
}

export function renderDateRangePicker({ field, filters = {}, label = "Período" } = {}) {
  const sanitized = sanitizePeriodFilters(filters);
  const display = formatPeriodFieldLabel(sanitized);
  const presetButtons = DATE_RANGE_PRESETS.map(
    (item) =>
      `<button type="button" class="drp-preset${sanitized.period === item.value ? " is-active" : ""}" data-drp-preset="${escapeHtml(item.value)}">${escapeHtml(item.label)}</button>`,
  ).join("");

  return `
    <div class="date-range-picker" data-drp-root>
      <span class="drp-label">${escapeHtml(label)}</span>
      <button type="button" class="drp-trigger" data-drp-trigger aria-haspopup="dialog" aria-expanded="false" aria-label="Selecionar período">
        <span class="drp-value" data-drp-value>${escapeHtml(display)}</span>
        <span class="drp-icon" aria-hidden="true">▾</span>
      </button>
      ${hiddenInput(field.id, sanitized.period)}
      ${hiddenInput(field.fromId || "filter-start-date", sanitized.startDate || "")}
      ${hiddenInput(field.toId || "filter-end-date", sanitized.endDate || "")}
      <div class="drp-popover" data-drp-popover hidden role="dialog" aria-label="Selecionar intervalo de datas">
        <div class="drp-presets" role="list">${presetButtons}</div>
        <div class="drp-calendar" data-drp-calendar></div>
        <div class="drp-actions">
          <button type="button" class="btn btn-secondary" data-drp-clear>Limpar</button>
          <button type="button" class="btn btn-primary" data-drp-apply>Aplicar</button>
        </div>
      </div>
    </div>
  `;
}

function renderCalendarGrid({ year, month, draft, now }) {
  const cells = monthMatrix(year, month, now);
  const dayButtons = cells
    .map((cell) => {
      if (!cell.inMonth) return `<span class="drp-day drp-day-empty" aria-hidden="true"></span>`;
      const { selected, edge, hoverEnd } = draftHighlight(cell.iso, draft);
      const classes = [
        "drp-day",
        cell.isToday ? "is-today" : "",
        cell.disabled ? "is-disabled" : "",
        selected ? "is-selected" : "",
        edge ? "is-edge" : "",
        hoverEnd ? "is-hover-end" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${classes}" data-drp-day="${escapeHtml(cell.iso)}" ${cell.disabled ? "disabled aria-disabled=true" : ""} aria-selected="${selected ? "true" : "false"}" aria-label="${escapeHtml(formatIsoDateBr(cell.iso))}">${cell.day}</button>`;
    })
    .join("");

  const next = shiftMonth(year, month, 1);
  const canNext = canNavigateToMonth(next.year, next.month, now);

  return `
    <div class="drp-calendar-head">
      <button type="button" class="drp-nav" data-drp-nav="-1" aria-label="Mês anterior">‹</button>
      <div class="drp-month-label">${escapeHtml(monthTitle(year, month))}</div>
      <button type="button" class="drp-nav" data-drp-nav="1" aria-label="Próximo mês" ${canNext ? "" : "disabled"}>›</button>
    </div>
    <div class="drp-weekdays">${WEEKDAYS.map((day) => `<span>${day}</span>`).join("")}</div>
    <div class="drp-grid" role="grid" aria-label="Calendário">${dayButtons}</div>
  `;
}

function writeHidden(field, values) {
  const periodEl = document.getElementById(field.id);
  const fromEl = document.getElementById(field.fromId || "filter-start-date");
  const toEl = document.getElementById(field.toId || "filter-end-date");
  if (periodEl) periodEl.value = values.period || "all";
  if (fromEl) fromEl.value = values.startDate || "";
  if (toEl) toEl.value = values.endDate || "";
}

export function bindDateRangePicker({ host, field, filters = {}, onApply, now = new Date() } = {}) {
  if (!host || !field) return () => {};
  const root = host.querySelector("[data-drp-root]");
  if (!root) return () => {};

  const trigger = root.querySelector("[data-drp-trigger]");
  const popover = root.querySelector("[data-drp-popover]");
  const calendarHost = root.querySelector("[data-drp-calendar]");
  const valueNode = root.querySelector("[data-drp-value]");
  const applyBtn = root.querySelector("[data-drp-apply]");
  const clearBtn = root.querySelector("[data-drp-clear]");

  let applied = sanitizePeriodFilters(filters, now);
  let draft = { period: applied.period, startDate: applied.startDate, endDate: applied.endDate, hover: "" };
  const anchorIso = applied.startDate || applied.endDate || todayIso(now);
  let view = { year: Number(anchorIso.slice(0, 4)), month: Number(anchorIso.slice(5, 7)) || 1 };

  const cleanups = [];
  let calendarCleanups = [];
  let portalBackdrop = null;
  let overlayRoot = null;
  let portalOpen = false;

  if (popover && popover.parentNode === root) {
    overlayRoot = ensureOverlayRoot();
    overlayRoot.appendChild(popover);
    popover.hidden = true;
  }

  function clearCalendarCleanups() {
    calendarCleanups.forEach((fn) => fn());
    calendarCleanups = [];
  }

  function syncApplied(values) {
    applied = sanitizePeriodFilters(values, now);
    writeHidden(field, applied);
    if (valueNode) valueNode.textContent = formatPeriodFieldLabel(applied, now);
  }

  function draftToRange() {
    if (draft.period === "all" || (!draft.startDate && !draft.endDate && draft.period === "all")) {
      return emptyPeriodRange();
    }
    if (draft.period && draft.period !== "custom") return applyPeriodPreset(draft.period, now);
    if (!isRangeComplete(draft.startDate, draft.endDate)) return null;
    return { period: "custom", startDate: draft.startDate, endDate: draft.endDate };
  }

  function updateApplyState() {
    const next = draftToRange();
    if (applyBtn) applyBtn.disabled = !next;
  }

  function syncPresetButtons() {
    popover?.querySelectorAll("[data-drp-preset]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.drpPreset === draft.period);
    });
  }

  function updateDayHighlights() {
    calendarHost?.querySelectorAll("[data-drp-day]").forEach((button) => {
      const iso = button.dataset.drpDay;
      if (!iso) return;
      const { selected, edge, hoverEnd } = draftHighlight(iso, draft);
      button.classList.toggle("is-selected", selected);
      button.classList.toggle("is-edge", edge);
      button.classList.toggle("is-hover-end", hoverEnd);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function bindCalendarEvents() {
    calendarHost.querySelectorAll("[data-drp-day]").forEach((button) => {
      if (button.disabled) return;
      const onDay = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const result = nextDraftAfterDayClick(draft, button.dataset.drpDay, now);
        if (!result.changed) return;
        draft = result.draft;
        updateDayHighlights();
        updateApplyState();
        popover?.querySelectorAll("[data-drp-preset]").forEach((item) => item.classList.remove("is-active"));
      };
      button.addEventListener("mousedown", onDay);
      calendarCleanups.push(() => button.removeEventListener("mousedown", onDay));
      const enter = () => {
        if (!draft.startDate || draft.endDate) return;
        const hoverIso = button.dataset.drpDay || "";
        if (draft.hover === hoverIso) return;
        draft.hover = hoverIso;
        updateDayHighlights();
      };
      button.addEventListener("mouseenter", enter);
      calendarCleanups.push(() => button.removeEventListener("mouseenter", enter));
    });
    const clearHover = () => {
      if (!draft.hover) return;
      draft.hover = "";
      updateDayHighlights();
    };
    calendarHost.addEventListener("mouseleave", clearHover);
    calendarCleanups.push(() => calendarHost.removeEventListener("mouseleave", clearHover));
    calendarHost.querySelectorAll("[data-drp-nav]").forEach((button) => {
      const handler = () => {
        const next = shiftMonth(view.year, view.month, Number(button.dataset.drpNav));
        if (!canNavigateToMonth(next.year, next.month, now)) return;
        view = next;
        paintCalendar();
      };
      button.addEventListener("click", handler);
      calendarCleanups.push(() => button.removeEventListener("click", handler));
    });
  }

  function paintCalendar() {
    if (!calendarHost) return;
    clearCalendarCleanups();
    calendarHost.innerHTML = renderCalendarGrid({ year: view.year, month: view.month, draft, now });
    bindCalendarEvents();
  }

  function onViewportChange() {
    if (!portalOpen || popover.hidden) return;
    positionAnchoredPopover({ anchor: trigger, popover });
  }

  function closePopover(restoreDraft = true) {
    if (restoreDraft) {
      draft = { period: applied.period, startDate: applied.startDate, endDate: applied.endDate, hover: "" };
    }
    portalOpen = false;
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange);
    unmountPopoverPortal({ overlayRoot, backdrop: portalBackdrop, popover });
    portalBackdrop = null;
    trigger?.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onEscape, true);
  }

  function onEscape(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePopover(true);
    }
  }

  function openPopover() {
    draft = { period: applied.period, startDate: applied.startDate, endDate: applied.endDate, hover: "" };
    const anchor = applied.startDate || applied.endDate || todayIso(now);
    view.year = Number(anchor.slice(0, 4));
    view.month = Number(anchor.slice(5, 7));
    trigger?.setAttribute("aria-expanded", "true");
    paintCalendar();
    updateApplyState();
    syncPresetButtons();
    const mounted = mountPopoverPortal({
      anchor: trigger,
      popover,
      overlayRoot: ensureOverlayRoot(),
      onDismiss: () => closePopover(true),
    });
    portalBackdrop = mounted.backdrop;
    overlayRoot = mounted.overlayRoot;
    portalOpen = true;
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    document.addEventListener("keydown", onEscape, true);
  }

  const onTrigger = (event) => {
    event.stopPropagation();
    if (!portalOpen) openPopover();
    else closePopover(true);
  };
  trigger?.addEventListener("click", onTrigger);
  cleanups.push(() => trigger?.removeEventListener("click", onTrigger));

  popover?.querySelectorAll("[data-drp-preset]").forEach((button) => {
    const handler = () => {
      const next = applyPeriodPreset(button.dataset.drpPreset || "all", now);
      draft = { ...next, hover: "" };
      if (draft.startDate) {
        view.year = Number(draft.startDate.slice(0, 4));
        view.month = Number(draft.startDate.slice(5, 7));
      }
      paintCalendar();
      updateApplyState();
      syncPresetButtons();
    };
    button.addEventListener("click", handler);
    cleanups.push(() => button.removeEventListener("click", handler));
  });

  const onClear = () => {
    draft = { ...emptyPeriodRange(), hover: "" };
    paintCalendar();
    updateApplyState();
    syncPresetButtons();
  };
  clearBtn?.addEventListener("click", onClear);
  cleanups.push(() => clearBtn?.removeEventListener("click", onClear));

  const onApplyClick = () => {
    const next = draftToRange();
    if (!next) return;
    syncApplied(next);
    closePopover(false);
    onApply?.(next);
  };
  applyBtn?.addEventListener("click", onApplyClick);
  cleanups.push(() => applyBtn?.removeEventListener("click", onApplyClick));

  syncApplied(applied);

  return () => {
    closePopover(true);
    popover?.remove();
    cleanups.forEach((fn) => fn());
    clearCalendarCleanups();
  };
}
