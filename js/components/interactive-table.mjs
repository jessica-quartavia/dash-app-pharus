import { paginateRows, paginationBar } from "./table-pagination.mjs";
import { matchesSearch } from "../lib/filters/apply.mjs";
import { escapeHtml } from "../utils/escape.mjs";

export function defaultTableState(overrides = {}) {
  return {
    search: "",
    sortKey: null,
    sortDir: "desc",
    page: 1,
    pageSize: 25,
    ...overrides,
  };
}

function sortIndicator(activeKey, key, dir) {
  if (activeKey !== key) return "";
  return dir === "asc" ? " ↑" : " ↓";
}

export function sortTableRows(rows, columns, sortKey, sortDir = "desc") {
  const col = columns.find((item) => item.key === sortKey);
  const getter =
    col?.sortValue ||
    (col?.key
      ? (row) => {
          const value = row[col.key];
          if (typeof value === "number") return value;
          return String(value ?? "").toLowerCase();
        }
      : null);
  if (!getter) return [...(rows || [])];
  const dir = sortDir === "asc" ? 1 : -1;
  return [...(rows || [])].sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (typeof av === "number" && typeof bv === "number") {
      if (av !== bv) return (av - bv) * dir;
    } else {
      const cmp = String(av).localeCompare(String(bv), "pt-BR");
      if (cmp !== 0) return cmp * dir;
    }
    return String(a.name || a.clientName || a.id || "").localeCompare(
      String(b.name || b.clientName || b.id || ""),
      "pt-BR",
    );
  });
}

export function filterTableRows(rows, search, { searchFn } = {}) {
  if (!search) return rows || [];
  if (searchFn) return (rows || []).filter((row) => searchFn(row, search));
  return (rows || []).filter((row) => matchesSearch(row, search));
}

export function renderInteractiveTablePanel({
  rows,
  columns,
  state,
  title,
  searchPlaceholder = "Buscar…",
  rowIdKey = "id",
  emptyTitle = "Nenhum registro neste recorte",
  emptyText = "Ajuste a busca ou os filtros.",
  panelClass = "interactive-table-panel",
  recorteTotal,
  hideSearch = true,
}) {
  const filtered = hideSearch ? rows || [] : filterTableRows(rows, state.search);
  const sorted = state.sortKey
    ? sortTableRows(filtered, columns, state.sortKey, state.sortDir)
    : filtered;
  const page = paginateRows(sorted, { page: state.page, pageSize: state.pageSize });
  const totalLabel = recorteTotal ?? filtered.length;

  const head = columns
    .map((col) => {
      const cls = [col.numeric ? "num" : "", col.sortable ? "sortable" : ""];
      if (col.sortable && state.sortKey === col.key) cls.push("is-sorted");
      const label = col.sortable
        ? `${col.label}${sortIndicator(state.sortKey, col.key, state.sortDir)}`
        : col.label;
      const attrs = col.sortable ? ` data-sort-key="${escapeHtml(col.key)}"` : "";
      return `<th class="${cls.filter(Boolean).join(" ")}"${attrs}>${escapeHtml(label)}</th>`;
    })
    .join("");

  const body = page.rows
    .map((row) => {
      const rowId = row[rowIdKey] ?? row.id;
      const cells = columns
        .map((col) => {
          const raw = col.value(row);
          const cls = col.numeric ? "num" : "";
          return `<td class="${cls}">${raw}</td>`;
        })
        .join("");
      return `<tr class="is-clickable" data-row-id="${escapeHtml(String(rowId))}" tabindex="0">${cells}</tr>`;
    })
    .join("");

  const table =
    page.total === 0
      ? `<div class="gd-status" role="status"><strong>${escapeHtml(emptyTitle)}</strong><span>${escapeHtml(emptyText)}</span></div>`
      : `<div class="table-wrap"><table class="gd-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table></div>`;

  return `<div class="${panelClass}" data-recorte="${totalLabel}">
    ${hideSearch ? "" : `<div class="table-toolbar">
      <label class="table-search">
        <span class="sr-only">Buscar na tabela</span>
        <input type="search" class="input" placeholder="${escapeHtml(searchPlaceholder)}" value="${escapeHtml(state.search || "")}" data-table-search />
      </label>
    </div>`}
    ${title ? `<div class="table-panel-head"><h3>${escapeHtml(title)}</h3></div>` : ""}
    <div class="interactive-table-body">${table}</div>
    ${paginationBar({ page: page.page, pageSize: page.pageSize, total: page.total })}
  </div>`;
}

export function bindInteractiveTable(host, options) {
  if (!host) return;

  const {
    rows,
    columns,
    state,
    rowIdKey = "id",
    onRowClick,
    onStateChange,
    title,
    searchPlaceholder,
    emptyTitle,
    emptyText,
    panelClass,
    recorteTotal,
    hideSearch = true,
  } = options;

  const refresh = () => {
    host.innerHTML = renderInteractiveTablePanel({
      rows,
      columns,
      state,
      title,
      searchPlaceholder,
      rowIdKey,
      emptyTitle,
      emptyText,
      panelClass,
      recorteTotal,
      hideSearch,
    });
    bindInteractiveTable(host, options);
  };

  if (!hideSearch) {
    host.querySelector("[data-table-search]")?.addEventListener("input", (event) => {
      state.search = event.target.value;
      state.page = 1;
      onStateChange?.(state);
      refresh();
    });
  }

  host.querySelectorAll("[data-sort-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = key === "name" || key === "clientName" ? "asc" : "desc";
      }
      state.page = 1;
      onStateChange?.(state);
      refresh();
    });
  });

  host.querySelector("[data-page-size]")?.addEventListener("change", (event) => {
    state.pageSize = Number(event.target.value) || 25;
    state.page = 1;
    onStateChange?.(state);
    refresh();
  });

  host.querySelector('[data-page-action="prev"]')?.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    onStateChange?.(state);
    refresh();
  });

  host.querySelector('[data-page-action="next"]')?.addEventListener("click", () => {
    state.page += 1;
    onStateChange?.(state);
    refresh();
  });

  host.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.page = Number(btn.dataset.page) || 1;
      onStateChange?.(state);
      refresh();
    });
  });

  const resolveRow = (rowEl) => {
    const id = rowEl.dataset.rowId;
    return (rows || []).find((item) => String(item[rowIdKey] ?? item.id) === String(id));
  };

  host.querySelectorAll("[data-row-id]").forEach((row) => {
    const open = () => {
      const item = resolveRow(row);
      if (item) onRowClick?.(item);
    };
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

export function mountInteractiveTable(hostId, config) {
  let tableRows = [];
  let tableState = defaultTableState(config.defaultState);
  const host = () => document.getElementById(hostId);

  const paint = () => {
    const el = host();
    if (!el) return;
    el.innerHTML = renderInteractiveTablePanel({
      rows: tableRows,
      columns: config.columns,
      state: tableState,
      title: config.title?.(tableRows, tableState),
      searchPlaceholder: config.searchPlaceholder,
      rowIdKey: config.rowIdKey,
      emptyTitle: config.emptyTitle,
      emptyText: config.emptyText,
      recorteTotal: config.recorteTotal?.(tableRows),
      hideSearch: config.hideSearch,
    });
    bindInteractiveTable(el, {
      rows: tableRows,
      columns: config.columns,
      state: tableState,
      rowIdKey: config.rowIdKey,
      searchFn: config.searchFn,
      searchPlaceholder: config.searchPlaceholder,
      emptyTitle: config.emptyTitle,
      emptyText: config.emptyText,
      recorteTotal: config.recorteTotal?.(tableRows),
      title: config.title?.(tableRows, tableState),
      hideSearch: config.hideSearch,
      onRowClick: config.onRowClick,
      onStateChange: (next) => {
        tableState = next;
      },
    });
  };

  return {
    mount(data) {
      tableRows = data.rows || data || [];
      tableState = defaultTableState(config.defaultState);
      paint();
    },
    refresh(data) {
      if (data?.rows) tableRows = data.rows;
      paint();
    },
  };
}
