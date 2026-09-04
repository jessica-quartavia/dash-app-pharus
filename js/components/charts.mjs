import { escapeHtml } from "../utils/escape.mjs";
import { sortDistributionUnknownLast } from "../utils/sort.mjs";
import { formatCurrencyCompact, formatCurrencyExact, formatDecimal, formatNumber, formatPercent } from "../utils/format.mjs";
import { EXPANDABLE_CHART_LIMIT, renderExpandableChartList } from "./expandable-chart-list.mjs";
import { bindFloatingTooltips } from "./floating-tooltip.mjs";

const STATUS_COLORS = {
  Ativo: "#0a0a0a",
  Inativo: "#737373",
  "Sem atividade recente": "#d18426",
  Saudável: "#0a0a0a",
  Atenção: "#d18426",
  Falha: "#e85d3a",
  Sucesso: "#0a0a0a",
  "Sucesso parcial": "#d18426",
  Problema: "#e85d3a",
  Concluído: "#0a0a0a",
  Iniciado: "#d18426",
  "Não iniciado": "#c4c4c4",
  Realizada: "#0a0a0a",
  Agendada: "#737373",
  "No-show": "#e85d3a",
  Cancelada: "#737373",
  "Não informado": "#e5e5e5",
};

export const CHART_CATEGORICAL_PALETTE = [
  "#e85d3a",
  "#0a0a0a",
  "#737373",
  "#d18426",
  "#4b5563",
  "#9ca3af",
  "#1f2937",
  "#cbd5e1",
];

function colorForLabel(label, index = 0) {
  if (STATUS_COLORS[label]) return STATUS_COLORS[label];
  return CHART_CATEGORICAL_PALETTE[index % CHART_CATEGORICAL_PALETTE.length];
}

export function hBars(items, options = {}) {
  const list = options.preserveOrder ? [...(items || [])] : sortDistributionUnknownLast(items || []);
  const rendered = options.limit ? list.slice(0, options.limit) : list;
  if (!rendered.length) return `<p class="placeholder-note">Sem dados para o recorte selecionado.</p>`;
  const max = Math.max(...rendered.map((item) => item.count), 1);
  const layoutClass = options.compact ? " hbar-layout--compact" : " hbar-layout--wide";
  const valueFormatter = options.valueFormatter || formatNumber;
  const rows = rendered
    .map((item) => {
      const metric = `${valueFormatter(item.count)} · ${formatPercent(item.percent)}`;
      const width = (item.count / max) * 100;
      return `<div class="hbar" title="${escapeHtml(item.label)}: ${escapeHtml(metric)}">
        <div class="hbar-label hbar-label--wrap">${escapeHtml(item.label)}</div>
        <div class="hbar-track"><span style="width:${width}%"></span></div>
        <div class="hbar-val">${escapeHtml(metric)}</div>
      </div>`;
    })
  if (options.expandable === false) return `<div class="hbar-list${layoutClass}">${rows.join("")}</div>`;
  return renderExpandableChartList(rows, {
    contentClass: `hbar-list${layoutClass}`,
    limit: options.initialLimit || EXPANDABLE_CHART_LIMIT,
  });
}

export function donut(items) {
  const list = sortDistributionUnknownLast(items || []);
  if (!list.length) return `<p class="placeholder-note">Sem dados para o recorte selecionado.</p>`;
  const total = list.reduce((sum, item) => sum + item.count, 0) || 1;
  let offset = 0;
  const radius = 42;
  const c = 2 * Math.PI * radius;
  const arcs = list
    .map((item, index) => {
      const len = (item.count / total) * c;
      const stroke = colorForLabel(item.label, index);
      const circle = `<circle cx="60" cy="60" r="${radius}" fill="none" stroke="${stroke}" stroke-width="14" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"></circle>`;
      offset += len;
      return circle;
    })
    .join("");
  const legend = list
    .map((item, index) => {
      const color = colorForLabel(item.label, index);
      return `<div><i style="background:${color}"></i>${escapeHtml(item.label)} — ${formatNumber(item.count)} (${formatPercent(item.percent)})</div>`;
    })
    .join("");
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">${arcs}<circle cx="60" cy="60" r="28" class="donut-hole"></circle></svg><div class="legend">${legend}</div></div>`;
}

function monthShortLabel(ym) {
  const [y, m] = String(ym).split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return ym;
  const label = `${names[idx]}/${String(y).slice(2)}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayShortLabel(dateStr) {
  const raw = String(dateStr || "").slice(0, 10);
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return raw;
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${dd} ${names[d.getUTCMonth()]}`;
}

function dayTooltipLabel(dateStr) {
  const raw = String(dateStr || "").slice(0, 10);
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return raw;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function dayLongLabel(dateStr) {
  const raw = String(dateStr || "").slice(0, 10);
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function usageLineChart(series, { valueKey = "count", maxItems = 90, unit = "uniqueUsers" } = {}) {
  const source = Array.isArray(series) ? series : [];
  const list = (maxItems && source.length > maxItems ? source.slice(-maxItems) : source)
    .map((item) => ({ ...item, value: Number(item[valueKey]) }))
    .filter((item) => Number.isFinite(item.value));
  if (!list.length) return `<p class="placeholder-note">Sem dados no período selecionado.</p>`;

  const width = 1000;
  const height = 300;
  const margin = { top: 20, right: 22, bottom: 46, left: 50 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...list.map((item) => item.value), 1);
  const xFor = (index) => margin.left + (list.length === 1 ? plotWidth / 2 : (index / (list.length - 1)) * plotWidth);
  const yFor = (value) => margin.top + plotHeight - (value / maxValue) * plotHeight;
  const points = list.map((item, index) => ({ ...item, x: xFor(index), y: yFor(item.value) }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const tickValues = maxValue <= 3
    ? Array.from({ length: maxValue + 1 }, (_, index) => index)
    : [...new Set([0, 1 / 3, 2 / 3, 1].map((ratio) => Math.round(maxValue * ratio)))];
  const grid = tickValues.map((value) => {
    const y = margin.top + plotHeight - (value / maxValue) * plotHeight;
    return `<g class="usage-line-grid"><line x1="${margin.left}" x2="${width - margin.right}" y1="${y}" y2="${y}"></line><text x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(formatNumber(value))}</text></g>`;
  }).join("");
  const labelStep = Math.max(1, Math.ceil((list.length - 1) / 6));
  const xLabels = points.map((point, index) => {
    if (index !== 0 && index !== points.length - 1 && index % labelStep !== 0) return "";
    return `<text class="usage-line-x-label" x="${point.x}" y="${height - 13}" text-anchor="middle">${escapeHtml(dayShortLabel(point.date || point.label).replace(/^0/, ""))}</text>`;
  }).join("");
  const pointMarkup = points.map((point) => {
    const date = dayLongLabel(point.date || point.label);
    const unitLabel = unit === "activeUsers"
      ? (point.value === 1 ? "usuário ativo" : "usuários ativos")
      : (point.value === 1 ? "usuário único" : "usuários únicos");
    const countLabel = `${formatNumber(point.value)} ${unitLabel}`;
    const tooltip = `${date}\n${countLabel}`;
    return `<g class="usage-line-point" tabindex="0" role="img" aria-label="${escapeHtml(`${date}, ${countLabel}`)}" data-line-point data-tooltip="${escapeHtml(tooltip)}">
      <circle class="usage-line-point-hit" cx="${point.x}" cy="${point.y}" r="12"></circle>
      <circle class="usage-line-point-dot" cx="${point.x}" cy="${point.y}" r="3.25"></circle>
    </g>`;
  }).join("");

  const chartLabel = unit === "activeUsers" ? "Evolução diária de usuários ativos" : "Evolução diária de usuários únicos";
  return `<div class="usage-line-chart" data-usage-line-chart>
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(chartLabel)}">
      ${grid}
      <path class="usage-line-path" d="${path}"></path>
      ${pointMarkup}
      ${xLabels}
    </svg>
  </div>`;
}

export function bindUsageLineChartTooltips(root = document) {
  bindFloatingTooltips(root);
}

export function csatScoreLine(series) {
  const list = (Array.isArray(series) ? series : [])
    .filter((item) => Number.isFinite(Number(item.average)))
    .map((item) => ({ ...item, value: Number(item.average) }));
  if (!list.length) return `<p class="placeholder-note">Sem dados no recorte selecionado.</p>`;

  const width = 1000;
  const height = 300;
  const margin = { top: 24, right: 22, bottom: 46, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const minValue = 1;
  const maxValue = 5;
  const xFor = (index) => margin.left + (list.length === 1 ? plotWidth / 2 : (index / (list.length - 1)) * plotWidth);
  const yFor = (value) => margin.top + plotHeight - ((value - minValue) / (maxValue - minValue)) * plotHeight;
  const points = list.map((item, index) => ({ ...item, x: xFor(index), y: yFor(item.value) }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const grid = [1, 2, 3, 4, 5].map((value) => {
    const y = yFor(value);
    return `<g class="usage-line-grid"><line x1="${margin.left}" x2="${width - margin.right}" y1="${y}" y2="${y}"></line><text x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${value}</text></g>`;
  }).join("");
  const xLabels = points.map((point) =>
    `<text class="usage-line-x-label" x="${point.x}" y="${height - 13}" text-anchor="middle">${escapeHtml(monthShortLabel(point.month))}</text>`,
  ).join("");
  const pointMarkup = points.map((point) => {
    const tooltip = `${monthShortLabel(point.month)}\nNota média: ${formatDecimal(point.value, { digits: 1 })}\n${formatNumber(point.count)} avaliações`;
    return `<g class="usage-line-point" tabindex="0" role="img" aria-label="${escapeHtml(tooltip.replace(/\n/g, ", "))}" data-line-point data-tooltip="${escapeHtml(tooltip)}">
      <circle class="usage-line-point-hit" cx="${point.x}" cy="${point.y}" r="12"></circle>
      <circle class="usage-line-point-dot" cx="${point.x}" cy="${point.y}" r="3.25"></circle>
    </g>`;
  }).join("");

  return `<div class="usage-line-chart csat-score-line" data-usage-line-chart>
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Evolução mensal da nota média">
      ${grid}
      <path class="usage-line-path" d="${path}"></path>
      ${pointMarkup}
      ${xLabels}
    </svg>
  </div>`;
}

export function dailyColumns(series, { valueKey = "count", titleSuffix = "usuários únicos", maxItems = 90 } = {}) {
  const source = Array.isArray(series) ? series : [];
  const list = maxItems && source.length > maxItems ? source.slice(-maxItems) : source;
  if (!list.length) return `<p class="placeholder-note">Sem dados no período selecionado.</p>`;
  const maxValue = Math.max(...list.map((item) => Number(item[valueKey]) || 0), 0);
  const plotH = 180;
  const useFit = list.length <= 14;
  const wrapClass = useFit ? "acq-chart-scroll is-fit" : "acq-chart-scroll";
  const colWidth = list.length <= 8 ? "minmax(52px, 1fr)" : "minmax(44px, 1fr)";
  return `<div class="${wrapClass}"><div class="acq-chart-grid" style="grid-auto-columns:${colWidth}">${list
    .map((item, idx) => {
      const count = Number(item[valueKey]) || 0;
      const heightPct = maxValue > 0 ? (count / maxValue) * 100 : 0;
      const barPx = count > 0 ? Math.max(Math.round((heightPct / 100) * plotH), 6) : 0;
      const latest = idx === list.length - 1;
      const dateKey = item.date || item.label;
      const label = dayShortLabel(dateKey);
      const tooltip = `${dayTooltipLabel(dateKey)}\n${titleSuffix}: ${formatNumber(count)}`;
      return `<div class="acq-col${latest ? " is-latest" : ""}" title="${escapeHtml(tooltip)}">
        <div class="acq-col-value">${escapeHtml(formatNumber(count))}</div>
        <div class="acq-col-bar" style="height:${barPx}px"></div>
        <div class="acq-col-label">${escapeHtml(label)}</div>
      </div>`;
    })
    .join("")}</div></div>`;
}

export function monthColumns(series, { valueKey = "count", titleSuffix = "clientes", format = "number", maxItems = null } = {}) {
  const source = Array.isArray(series) ? series : [];
  const list = maxItems && source.length > maxItems ? source.slice(-maxItems) : source;
  if (!list.length) return `<p class="placeholder-note">Sem meses para exibir no recorte selecionado.</p>`;
  const maxValue = Math.max(...list.map((item) => Number(item[valueKey]) || 0), 0);
  const plotH = format === "currency" ? 168 : 180;
  const currency = format === "currency";
  const wrapClass = currency || list.length <= 6 ? "acq-chart-scroll is-fit" : "acq-chart-scroll";
  const gridClass = currency ? "acq-chart-grid is-currency" : "acq-chart-grid";
  return `<div class="${wrapClass}"><div class="${gridClass}" data-cols="${list.length}">${list
    .map((item, idx) => {
      const count = Number(item[valueKey]) || 0;
      const heightPct = maxValue > 0 ? (count / maxValue) * 100 : 0;
      const barPx = count > 0 ? Math.max(Math.round((heightPct / 100) * plotH), 6) : 0;
      const latest = idx === list.length - 1;
      const month = item.month || item.label;
      const monthLabel = monthShortLabel(month);
      const label = currency ? formatCurrencyCompact(count) : formatNumber(count);
      const tooltip = currency
        ? `${monthLabel} — Patrimônio: ${formatCurrencyExact(count)}`
        : `${monthLabel}: ${formatNumber(count)} ${titleSuffix}`;
      return `<div class="acq-col${latest ? " is-latest" : ""}" title="${escapeHtml(tooltip)}">
        <div class="acq-col-value">${escapeHtml(label)}</div>
        <div class="acq-col-bar" style="height:${barPx}px"></div>
        <div class="acq-col-label">${escapeHtml(monthLabel)}</div>
      </div>`;
    })
    .join("")}</div></div>`;
}

export function dualColumns(series, { primaryKey, secondaryKey, primaryLabel, secondaryLabel }) {
  const list = Array.isArray(series) ? series : [];
  if (!list.length) return `<p class="placeholder-note">Sem dados para o recorte selecionado.</p>`;
  const max = Math.max(...list.flatMap((item) => [Number(item[primaryKey]) || 0, Number(item[secondaryKey]) || 0]), 1);
  const cols = list
    .map((item) => {
      const primary = Number(item[primaryKey]) || 0;
      const secondary = Number(item[secondaryKey]) || 0;
      const month = item.month || item.label;
      return `<div class="dual-col" title="${escapeHtml(monthShortLabel(month))}: ${escapeHtml(primaryLabel)} ${formatNumber(primary)} · ${escapeHtml(secondaryLabel)} ${formatNumber(secondary)}">
        <div class="dual-col-pair">
          <div class="dual-col-bar primary" style="height:${Math.max(Math.round((primary / max) * 180), primary ? 6 : 0)}px"></div>
          <div class="dual-col-bar secondary" style="height:${Math.max(Math.round((secondary / max) * 180), secondary ? 6 : 0)}px"></div>
        </div>
        <div class="acq-col-label">${escapeHtml(monthShortLabel(month))}</div>
      </div>`;
    })
    .join("");
  return `<div class="dual-bars">${cols}</div>
    <p class="chart-legend-note"><span><i class="swatch"></i>${escapeHtml(primaryLabel)}</span><span><i class="swatch secondary"></i>${escapeHtml(secondaryLabel)}</span></p>`;
}

export function funnelRows(items) {
  const list = items || [];
  if (!list.length) return `<p class="placeholder-note">Sem dados para o recorte selecionado.</p>`;
  const max = Math.max(...list.map((item) => item.count), 1);
  return `<div class="funnel-list">${list
    .map((item) => {
      const width = (item.count / max) * 100;
      const metric = `${formatNumber(item.count)} · ${formatPercent(item.percent)}`;
      return `<div class="funnel-row" title="${escapeHtml(item.label)}: ${escapeHtml(metric)}">
        <div>${escapeHtml(item.label)}</div>
        <div class="funnel-track"><span style="width:${width}%"></span></div>
        <div class="hbar-val">${escapeHtml(metric)}</div>
      </div>`;
    })
    .join("")}</div>`;
}
