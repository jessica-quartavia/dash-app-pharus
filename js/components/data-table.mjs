import { escapeHtml } from "../utils/escape.mjs";

export function dataTable({
  columns,
  rows,
  rowIdKey = "id",
  clickable = false,
  emptyTitle = "Nenhum registro neste recorte",
  emptyText = "Ajuste os filtros ou aguarde a atualização dos dados.",
}) {
  if (!rows?.length) {
    return `<div class="gd-status" role="status"><strong>${escapeHtml(emptyTitle)}</strong><span>${escapeHtml(emptyText)}</span></div>`;
  }

  const head = columns
    .map((col) => `<th class="${col.numeric ? "num" : ""}">${escapeHtml(col.label)}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const raw = typeof col.value === "function" ? col.value(row) : row[col.key];
          const cls = [col.numeric ? "num" : "", col.truncate ? "truncate" : ""].filter(Boolean).join(" ");
          return `<td class="${cls}">${raw}</td>`;
        })
        .join("");
      const id = row[rowIdKey] ? ` data-row-id="${escapeHtml(row[rowIdKey])}"` : "";
      const click = clickable ? " is-clickable" : "";
      return `<tr class="${click}"${id}>${cells}</tr>`;
    })
    .join("");

  return `<div class="table-wrap"><table class="gd-table">
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

export function tablePanel({ title, action = "", table }) {
  return `<div>
    <div class="table-panel-head">
      <h3>${escapeHtml(title)}</h3>
      ${action}
    </div>
    ${table}
  </div>`;
}
