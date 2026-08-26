import { escapeHtml } from "../utils/escape.mjs";
import { formatNumber } from "../utils/format.mjs";

export function paginateRows(rows, { page = 1, pageSize = 25 } = {}) {
  const total = rows?.length || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    rows: (rows || []).slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const list = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    if (i > 0 && list[i] - list[i - 1] > 1) out.push("…");
    out.push(list[i]);
  }
  return out;
}

export function paginationBar({ page, pageSize, total, pageSizes = [25, 50, 100], id = "table-pagination" }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total ? (safePage - 1) * pageSize + 1 : 0;
  const to = total ? Math.min(safePage * pageSize, total) : 0;
  const numbers = pageNumbers(safePage, totalPages)
    .map((item) =>
      item === "…"
        ? `<span class="pagination-ellipsis">…</span>`
        : `<button type="button" class="btn btn-ghost pagination-page${item === safePage ? " is-active" : ""}" data-page="${item}">${item}</button>`,
    )
    .join("");

  return `<div class="pagination" id="${escapeHtml(id)}">
    <div class="pagination-meta">${formatNumber(from)}–${formatNumber(to)} de ${formatNumber(total)}</div>
    <div class="pagination-controls">
      <button type="button" class="btn btn-ghost" data-page-action="prev"${safePage <= 1 ? " disabled" : ""}>Anterior</button>
      ${numbers}
      <button type="button" class="btn btn-ghost" data-page-action="next"${safePage >= totalPages ? " disabled" : ""}>Próxima</button>
    </div>
    <label class="pagination-size">
      <span>Por página</span>
      <select data-page-size>
        ${pageSizes
          .map((size) => `<option value="${size}"${size === pageSize ? " selected" : ""}>${size}</option>`)
          .join("")}
      </select>
    </label>
  </div>`;
}
