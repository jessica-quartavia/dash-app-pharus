import { escapeHtml } from "../utils/escape.mjs";
import { bindDateRangePicker, renderDateRangePicker } from "./date-range-picker.mjs";
import { isStickyFiltersEnabled, setStickyFiltersEnabled, syncStickyFiltersClass } from "../lib/ui-preferences.mjs";

function optionHtml(options, selected) {
  return (options || [])
    .map((item) => {
      const value = item.value ?? item;
      const label = item.label ?? item;
      return `<option value="${escapeHtml(value)}"${String(value) === String(selected) ? " selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

export function renderFilterBar({ fields, filters, note = "", periodInvalid = false } = {}) {
  const controls = (fields || []).map((field) => {
    if (field.kind === "search") {
      return `<label class="filter-search">Busca<input id="${escapeHtml(field.id)}" type="search" placeholder="Nome, e-mail ou ID" value="${escapeHtml(filters.search || "")}" /></label>`;
    }
    if (field.kind === "period") {
      return renderDateRangePicker({ field, filters, label: field.label || "Período" });
    }
    if (field.kind === "select") {
      return `<label>${escapeHtml(field.label)}<select id="${escapeHtml(field.id)}">${optionHtml(field.options, filters[field.key])}</select></label>`;
    }
    return "";
  });
  const error = periodInvalid
    ? `<p class="filter-error">Selecione um intervalo válido. A data inicial não pode ser posterior à final.</p>`
    : "";
  const noteHtml = note ? `<p class="filter-semantics">${escapeHtml(note)}</p>` : "";
  const stickyChecked = isStickyFiltersEnabled() ? " checked" : "";
  return `
    <div class="filter-shell">
      <div class="filter-bar">
        ${controls.join("")}
        <div class="filter-actions">
          <button class="btn btn-secondary" type="button" data-filter-clear>Limpar</button>
        </div>
      </div>
      <label class="filter-sticky-toggle">
        <span>Fixar filtros</span>
        <input type="checkbox" role="switch" aria-label="Fixar filtros ao rolar" data-sticky-filters${stickyChecked} />
      </label>
    </div>
    ${error}
    ${noteHtml}
  `;
}

export function bindFilterBar({ host, fields, filters, onChange, onClear } = {}) {
  if (!host) return () => {};
  const abort = new AbortController();
  const signal = abort.signal;
  const unbindPickers = [];
  let current = { ...filters };

  syncStickyFiltersClass();

  const readNonPeriod = (base) => {
    const next = { ...base };
    for (const field of fields || []) {
      if (field.kind === "search") {
        next.search = host.querySelector(`#${field.id}`)?.value || "";
      } else if (field.kind === "select") {
        next[field.key] = host.querySelector(`#${field.id}`)?.value || "all";
      }
    }
    return next;
  };

  const emitNonPeriod = () => {
    current = readNonPeriod(current);
    onChange?.(current);
  };

  for (const field of fields || []) {
    if (field.kind !== "period") continue;
    unbindPickers.push(
      bindDateRangePicker({
        host,
        field,
        filters: current,
        onApply: (range) => {
          current = readNonPeriod({
            ...current,
            period: range.period,
            startDate: range.startDate,
            endDate: range.endDate,
            dateFrom: range.startDate || "",
            dateTo: range.endDate || "",
          });
          onChange?.(current);
        },
      }),
    );
  }

  let searchTimer = null;
  const onInput = (event) => {
    if (event.target?.closest?.("[data-drp-root]")) return;
    if (event.target?.type === "search") {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(emitNonPeriod, 250);
      return;
    }
    if (event.target?.tagName === "SELECT") emitNonPeriod();
  };
  host.addEventListener("input", onInput, { signal });
  host.addEventListener(
    "change",
    (event) => {
      if (event.target?.closest?.("[data-drp-root]")) return;
      if (event.target?.matches?.("[data-sticky-filters]")) {
        setStickyFiltersEnabled(event.target.checked);
        return;
      }
      if (event.target?.tagName === "SELECT") emitNonPeriod();
    },
    { signal },
  );
  host.querySelector("[data-filter-clear]")?.addEventListener(
    "click",
    () => {
      onClear?.();
    },
    { signal },
  );

  return () => {
    clearTimeout(searchTimer);
    unbindPickers.forEach((unbind) => unbind?.());
    abort.abort();
  };
}
