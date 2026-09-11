/**
 * Exportação de tabelas — CSV (Excel BR) e XLSX OpenXML real.
 * Opera sobre o recorte já filtrado/ordenado. A paginação não entra aqui.
 */

const CSV_BOM = "\uFEFF";
export const CSV_DELIMITER = ";";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

export function exportFileName(slug, ext, now = new Date()) {
  const safe = String(slug || "tabela")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "tabela";
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const suffix = String(ext || "csv").replace(/^\./, "");
  return `pharus-${safe}-${year}-${month}-${day}.${suffix}`;
}

export function resolveExportColumns(exportColumns, visualColumns = []) {
  if (exportColumns?.length) return exportColumns;
  return visualColumns
    .filter((col) => col && col.export !== false)
    .map((col) => ({
      key: col.key,
      label: col.label,
      type: col.exportType || (col.numeric ? "number" : "text"),
      get: col.exportValue,
    }));
}

export function formatExportDate(value) {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

export function formatExportDateTime(value) {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()} ${hh}:${min}`;
}

export function formatExportBoolean(value) {
  if (value == null) return "Dados indisponíveis";
  return value ? "Sim" : "Não";
}

function stripMarkup(value) {
  const text = String(value ?? "");
  if (!/[<&>]/.test(text)) return text;
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function rawCell(row, column) {
  if (typeof column.get === "function") return column.get(row);
  return row?.[column.key];
}

export function csvCell(row, column) {
  const type = column.type || "text";
  const raw = rawCell(row, column);
  if (type === "boolean") return formatExportBoolean(raw);
  if (raw == null || raw === "") return "";
  if (type === "date") return formatExportDate(raw);
  if (type === "datetime") return formatExportDateTime(raw);
  if (Array.isArray(raw)) return raw.filter(Boolean).join(", ");
  if (type === "percent") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "";
    return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }
  if (type === "currency") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (type === "number" || type === "decimal") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "";
    const digits = type === "decimal" || !Number.isInteger(n) ? (column.digits ?? 1) : 0;
    return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  return stripMarkup(raw);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildCsv(rows, columns) {
  const header = columns.map((col) => escapeCsv(col.label)).join(CSV_DELIMITER);
  const lines = (rows || []).map((row) => columns.map((col) => escapeCsv(csvCell(row, col))).join(CSV_DELIMITER));
  return `${CSV_BOM}${[header, ...lines].join("\r\n")}\r\n`;
}

export function parseCsvDataRows(csv) {
  const text = String(csv || "").replace(/^\uFEFF/, "");
  if (!text.trim()) return [];
  const rows = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === "\n") {
      const line = current.replace(/\r$/, "");
      if (line !== "") rows.push(line);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.replace(/\r$/, "") !== "") rows.push(current.replace(/\r$/, ""));
  return rows.slice(1);
}

function excelSerial(value, withTime) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    withTime ? date.getUTCHours() : 0,
    withTime ? date.getUTCMinutes() : 0,
    withTime ? date.getUTCSeconds() : 0,
  );
  return (utc - Date.UTC(1899, 11, 30)) / 86400000;
}

function colLetter(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xlsxCellXml(row, column, rowIndex, colIndex) {
  const ref = `${colLetter(colIndex)}${rowIndex}`;
  const type = column.type || "text";
  const raw = rawCell(row, column);
  if (type === "boolean") {
    return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(formatExportBoolean(raw))}</t></is></c>`;
  }
  if (raw == null || raw === "") return `<c r="${ref}"/>`;
  if (type === "date") {
    const serial = excelSerial(raw, false);
    if (serial == null) return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(formatExportDate(raw))}</t></is></c>`;
    return `<c r="${ref}" s="2"><v>${serial}</v></c>`;
  }
  if (type === "datetime") {
    const serial = excelSerial(raw, true);
    if (serial == null) return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(formatExportDateTime(raw))}</t></is></c>`;
    return `<c r="${ref}" s="3"><v>${serial}</v></c>`;
  }
  if (type === "currency") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return `<c r="${ref}"/>`;
    return `<c r="${ref}" s="4"><v>${n}</v></c>`;
  }
  if (type === "percent") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return `<c r="${ref}"/>`;
    return `<c r="${ref}" s="5"><v>${n / 100}</v></c>`;
  }
  if (type === "number" || type === "decimal") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return `<c r="${ref}"/>`;
    const style = type === "decimal" ? ' s="6"' : "";
    return `<c r="${ref}"${style}><v>${n}</v></c>`;
  }
  const text = Array.isArray(raw) ? raw.filter(Boolean).join(", ") : stripMarkup(raw);
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function sheetXml(rows, columns) {
  const lastCol = colLetter(Math.max(0, columns.length - 1));
  const lastRow = (rows || []).length + 1;
  const header = columns
    .map((col, index) => `<c r="${colLetter(index)}1" t="inlineStr" s="1"><is><t>${escapeXml(col.label)}</t></is></c>`)
    .join("");
  const body = (rows || [])
    .map((row, rowIndex) => {
      const r = rowIndex + 2;
      const cells = columns.map((col, colIndex) => xlsxCellXml(row, col, r, colIndex)).join("");
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCol}${lastRow}"/><sheetData><row r="1">${header}</row>${body}</sheetData></worksheet>`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16(n) {
  return Uint8Array.of(n & 255, (n >>> 8) & 255);
}

function u32(n) {
  return Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255);
}

async function deflateRaw(bytes) {
  if (typeof CompressionStream === "function") {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const zlib = await import("node:zlib");
  return zlib.deflateRawSync(bytes);
}

async function zipFiles(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
    const compressed = await deflateRaw(data);
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      compressed,
    ]);
    const central = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralDir = concatBytes(centrals);
  const eocd = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return concatBytes([...locals, centralDir, eocd]);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Dados" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3">
<numFmt numFmtId="164" formatCode="DD/MM/YYYY"/>
<numFmt numFmtId="165" formatCode="DD/MM/YYYY\\ HH:MM"/>
<numFmt numFmtId="166" formatCode="&quot;R$&quot;\\ #,##0.00"/>
</numFmts>
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="7">
<xf xfId="0"/>
<xf xfId="0" fontId="1" applyFont="1"/>
<xf xfId="0" numFmtId="164" applyNumberFormat="1"/>
<xf xfId="0" numFmtId="165" applyNumberFormat="1"/>
<xf xfId="0" numFmtId="166" applyNumberFormat="1"/>
<xf xfId="0" numFmtId="10" applyNumberFormat="1"/>
<xf xfId="0" numFmtId="2" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;

export async function buildXlsx(rows, columns) {
  return zipFiles([
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    { name: "_rels/.rels", data: ROOT_RELS },
    { name: "xl/workbook.xml", data: WORKBOOK },
    { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS },
    { name: "xl/styles.xml", data: STYLES },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml(rows, columns) },
  ]);
}

export function isXlsxZip(bytes) {
  return Boolean(bytes && bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04);
}

export function canExportRows(rows, { loading = false } = {}) {
  return !loading && Array.isArray(rows) && rows.length > 0;
}
