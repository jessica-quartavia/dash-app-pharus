import { paginateRows, paginationBar } from "../components/table-pagination.mjs";
import { matchesSearch } from "./filters/apply.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatNumber } from "../utils/format.mjs";

const SORT_KEYS = {
  name: (row) => String(row.name || "").toLowerCase(),
  mechanismsImplemented: (row) => Number(row.mechanismsImplemented) || 0,
  firstMechanismAt: (row) => String(row.firstMechanismAt || ""),
  lastMechanismAt: (row) => String(row.lastMechanismAt || ""),
};

export function sortMechanismRows(rows, sortKey, sortDir = "desc") {
  const getter = SORT_KEYS[sortKey] || SORT_KEYS.mechanismsImplemented;
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
    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
  });
}

function sortIndicator(activeKey, key, dir) {
  if (activeKey !== key) return "";
  return dir === "asc" ? " ↑" : " ↓";
}

export function renderMechanismsClientTable(rows, state, { recorteTotal, officialTotal }) {
  const filtered = state.search
    ? (rows || []).filter((row) => matchesSearch(row, state.search))
    : rows || [];
  const sorted = sortMechanismRows(filtered, state.sortKey, state.sortDir);
  const page = paginateRows(sorted, { page: state.page, pageSize: state.pageSize });
  const columns = [
    {
      key: "name",
      label: `Cliente${sortIndicator(state.sortKey, "name", state.sortDir)}`,
      sortable: true,
      value: (row) =>
        `<strong>${escapeHtml(row.name)}</strong><div class="text-muted">${escapeHtml(row.email || row.id)}</div>`,
    },
    {
      key: "mechanismsImplemented",
      label: `Implementados${sortIndicator(state.sortKey, "mechanismsImplemented", state.sortDir)}`,
      sortable: true,
      numeric: true,
      value: (row) => formatNumber(row.mechanismsImplemented),
    },
    {
      key: "firstMechanismAt",
      label: `Primeiro mecanismo${sortIndicator(state.sortKey, "firstMechanismAt", state.sortDir)}`,
      sortable: true,
      value: (row) => formatDate(row.firstMechanismAt),
    },
    {
      key: "lastMechanismAt",
      label: `Último mecanismo${sortIndicator(state.sortKey, "lastMechanismAt", state.sortDir)}`,
      sortable: true,
      value: (row) => formatDate(row.lastMechanismAt),
    },
  ];

  const head = columns
    .map((col) => {
      const cls = [col.numeric ? "num" : "", col.sortable ? "sortable" : ""];
      if (col.sortable && state.sortKey === col.key) cls.push("is-sorted");
      const attrs = col.sortable ? ` data-sort-key="${escapeHtml(col.key)}"` : "";
      return `<th class="${cls.filter(Boolean).join(" ")}"${attrs}>${escapeHtml(col.label)}</th>`;
    })
    .join("");

  const body = page.rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const raw = col.value(row);
          const cls = col.numeric ? "num" : "";
          return `<td class="${cls}">${raw}</td>`;
        })
        .join("");
      return `<tr class="is-clickable" data-row-id="${escapeHtml(row.id)}" tabindex="0">${cells}</tr>`;
    })
    .join("");

  const table =
    page.total === 0
      ? `<div class="gd-status" role="status"><strong>Nenhum cliente neste recorte</strong><span>Ajuste a busca ou os filtros.</span></div>`
      : `<div class="table-wrap"><table class="gd-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table></div>`;

  return `<div class="mech-table-panel" data-recorte="${recorteTotal}" data-official="${officialTotal}">
    <div class="table-toolbar">
      <label class="table-search">
        <span class="sr-only">Buscar cliente</span>
        <input type="search" class="input" placeholder="Buscar por nome, e-mail ou ID" value="${escapeHtml(state.search || "")}" data-mech-search />
      </label>
    </div>
    <div class="table-panel-head">
      <h3>${formatNumber(recorteTotal)} clientes no recorte</h3>
    </div>
    <div class="mech-table-body">${table}</div>
    ${paginationBar({ page: page.page, pageSize: page.pageSize, total: page.total })}
  </div>`;
}

export function defaultMechanismsTableState() {
  return {
    search: "",
    sortKey: "mechanismsImplemented",
    sortDir: "desc",
    page: 1,
    pageSize: 25,
  };
}

export function bindMechanismsClientTable(host, rows, state, { onRowClick, onStateChange }) {
  if (!host) return;

  const refresh = () => {
    const panel = host.querySelector(".mech-table-panel");
    const recorteTotal = Number(panel?.dataset.recorte || rows.length);
    const officialTotal = Number(panel?.dataset.official || rows.length);
    host.innerHTML = renderMechanismsClientTable(rows, state, { recorteTotal, officialTotal });
    bindMechanismsClientTable(host, rows, state, { onRowClick, onStateChange });
  };

  host.querySelector("[data-mech-search]")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    state.page = 1;
    onStateChange?.(state);
    refresh();
  });

  host.querySelectorAll("[data-sort-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = key === "name" ? "asc" : "desc";
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

  const openRow = (rowEl) => {
    const client = rows.find((item) => String(item.id) === String(rowEl.dataset.rowId));
    if (client) onRowClick?.(client);
  };

  host.querySelectorAll("[data-row-id]").forEach((row) => {
    row.addEventListener("click", () => openRow(row));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openRow(row);
      }
    });
  });
}
