import { bindFilterBar, renderFilterBar } from "../components/filter-bar.mjs";
import { errorState } from "../components/error-state.mjs";
import { loadingState } from "../components/loading-state.mjs";
import { defaultFilters, resolvePeriodRange } from "./filters/apply.mjs";
import { PAGE_FILTERS } from "./filters/contracts.mjs";
import { syncStickyFiltersClass } from "./ui-preferences.mjs";

const pageState = new Map();

export function mountPage({
  pageId,
  load,
  render,
  filterNote = "Todos os indicadores desta página respeitam os filtros.",
  resolveFields = null,
}) {
  const baseFields = PAGE_FILTERS()[pageId] || [];
  pageState.set(pageId, {
    filters: defaultFilters(),
    unbindFilters: null,
    abort: null,
    fields: baseFields,
    resolveFields,
    lastFieldSignature: "",
  });

  document.addEventListener("page:navigate", (event) => {
    const currentId = event.detail?.pageId;
    if (currentId !== pageId) {
      pageState.get(pageId)?.unbindFilters?.();
      return;
    }
    void refresh(pageId, { load, render, filterNote, force: true });
  });
}

function fieldSignature(fields = []) {
  return fields
    .map((field) => {
      if (field.key === "advisor") {
        return `${field.key}:${(field.options || []).map((item) => item.value).join(",")}`;
      }
      return field.key;
    })
    .join("|");
}

async function refresh(pageId, { load, render, filterNote, force = false }) {
  const state = pageState.get(pageId);
  if (!state) return;
  const filtersEl = document.getElementById("page-filters");
  const contentEl = document.getElementById("page-content");
  if (!filtersEl || !contentEl) return;

  const range = resolvePeriodRange(state.filters);
  let fields = state.fields;

  if (range.invalid) {
    contentEl.innerHTML = errorState({
      title: "Período inválido",
      text: "Ajuste as datas do filtro para carregar os indicadores.",
    });
    return;
  }

  contentEl.innerHTML = loadingState();
  let data;
  try {
    data = await load(state.filters, { force });
  } catch (error) {
    console.error(`[page] ${pageId}`, error);
    contentEl.innerHTML = errorState({
      title: "Não foi possível carregar esta página",
      text: error instanceof Error ? error.message : "Tente novamente. Se o problema persistir, recarregue o portal.",
    });
    contentEl.querySelector("[data-page-retry]")?.addEventListener("click", () => {
      void refresh(pageId, { load, render, filterNote, force: true });
    });
    return;
  }

  if (state.resolveFields) {
    fields = state.resolveFields(data) || state.fields;
    state.fields = fields;
  }

  const signature = fieldSignature(fields);
  const shouldRebind = force || !filtersEl.dataset.bound || signature !== state.lastFieldSignature;

  if (!fields.length) {
    filtersEl.hidden = true;
    filtersEl.innerHTML = "";
    filtersEl.dataset.bound = "";
    state.unbindFilters?.();
  } else {
    filtersEl.hidden = false;
    if (shouldRebind) {
      state.unbindFilters?.();
      filtersEl.innerHTML = renderFilterBar({
        fields,
        filters: state.filters,
        note: filterNote,
        periodInvalid: range.invalid,
      });
      filtersEl.dataset.bound = "true";
      state.lastFieldSignature = signature;
      state.unbindFilters = bindFilterBar({
        host: filtersEl,
        fields,
        filters: state.filters,
        onChange: (next) => {
          state.filters = next;
          void refresh(pageId, { load, render, filterNote });
        },
        onClear: () => {
          state.filters = defaultFilters();
          filtersEl.dataset.bound = "";
          void refresh(pageId, { load, render, filterNote, force: true });
        },
      });
    }
    syncStickyFiltersClass();
  }

  try {
    contentEl.innerHTML = render(data, state.filters);
    contentEl.querySelector("[data-page-retry]")?.addEventListener("click", () => {
      void refresh(pageId, { load, render, filterNote, force: true });
    });
  } catch (error) {
    console.error(`[page] ${pageId}`, error);
    contentEl.innerHTML = errorState({
      title: "Não foi possível renderizar esta página",
      text: error instanceof Error ? error.message : "Tente novamente.",
    });
  }
}
