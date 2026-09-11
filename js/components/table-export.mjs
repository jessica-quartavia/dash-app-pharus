import { escapeHtml } from "../utils/escape.mjs";
import { formatNumber } from "../utils/format.mjs";
import {
  buildCsv,
  buildXlsx,
  canExportRows,
  exportFileName,
  resolveExportColumns,
} from "../lib/export-table.mjs";

const DOWNLOAD_ICON = `<svg class="table-export-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v10m0 0-3.5-3.5M12 14l3.5-3.5M5 18h14"/></svg>`;

function exportTip(format, count) {
  if (!count) return "Nenhum dado para exportar";
  const kind = format === "csv" ? "CSV" : "Excel";
  return `Exportar todos os registros filtrados em ${kind}`;
}

function exportButton({ format, label, count, loading, disabled }) {
  const title = loading ? "Aguarde o carregamento da tabela" : exportTip(format, count);
  const attrs = [
    `type="button"`,
    `class="btn btn-ghost table-export-btn"`,
    `data-table-export="${escapeHtml(format)}"`,
    `title="${escapeHtml(title)}"`,
    `aria-label="${escapeHtml(title)}"`,
  ];
  if (disabled) attrs.push("disabled", `aria-disabled="true"`);
  return `<button ${attrs.join(" ")}>${DOWNLOAD_ICON}<span>${escapeHtml(label)}</span></button>`;
}

export function renderTableExportControls({
  count = 0,
  loading = false,
  emptyText = "Nenhum dado para exportar",
} = {}) {
  const disabled = loading || count <= 0;
  const meta = loading
    ? "Aguarde o carregamento"
    : count
      ? `Exporta ${formatNumber(count)} registros`
      : emptyText;
  return `<div class="table-export" data-table-export-host>
    <p class="table-export-meta sr-only">${escapeHtml(meta)}</p>
    <div class="table-export-desktop">
      ${exportButton({ format: "csv", label: "Exportar CSV", count, loading, disabled })}
      ${exportButton({ format: "xlsx", label: "Exportar Excel", count, loading, disabled })}
    </div>
    <details class="table-export-menu${disabled ? " is-disabled" : ""}">
      <summary class="btn btn-ghost table-export-btn"${disabled ? " aria-disabled=\"true\"" : ""}>
        ${DOWNLOAD_ICON}<span>Exportar</span>
      </summary>
      <div class="table-export-menu-list">
        ${exportButton({ format: "csv", label: "CSV", count, loading, disabled })}
        ${exportButton({ format: "xlsx", label: "Excel", count, loading, disabled })}
      </div>
    </details>
  </div>`;
}

export function downloadBlob(data, fileName, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportPreparedRows({
  format,
  rows,
  columns,
  fileSlug,
  loading = false,
  download = downloadBlob,
  now = new Date(),
}) {
  if (!canExportRows(rows, { loading })) {
    return { ok: false, reason: loading ? "loading" : "empty" };
  }
  const resolved = resolveExportColumns(columns);
  if (format === "csv") {
    const csv = buildCsv(rows, resolved);
    download(csv, exportFileName(fileSlug, "csv", now), "text/csv;charset=utf-8");
    return { ok: true, count: rows.length, fileName: exportFileName(fileSlug, "csv", now) };
  }
  if (format === "xlsx") {
    const bytes = await buildXlsx(rows, resolved);
    const fileName = exportFileName(fileSlug, "xlsx", now);
    download(bytes, fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return { ok: true, count: rows.length, fileName };
  }
  return { ok: false, reason: "format" };
}

export function bindTableExport(host, {
  getRows,
  columns,
  fileSlug,
  loading = false,
  download = downloadBlob,
} = {}) {
  if (!host) return;
  host.querySelectorAll("[data-table-export]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      const format = button.dataset.tableExport;
      const rows = getRows?.() || [];
      await exportPreparedRows({
        format,
        rows,
        columns,
        fileSlug,
        loading,
        download,
      });
    });
  });
}
