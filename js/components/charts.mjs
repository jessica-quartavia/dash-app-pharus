import { escapeHtml } from "../utils/escape.mjs";
import { sortDistributionUnknownLast } from "../utils/sort.mjs";
import { formatCurrencyCompact, formatCurrencyExact, formatNumber, formatPercent } from "../utils/format.mjs";

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
  const visible = options.limit ? list.slice(0, options.limit) : list;
  if (!visible.length) return `<p class="placeholder-note">Sem dados para o recorte selecionado.</p>`;
  const max = Math.max(...visible.map((item) => item.count), 1);
  const layoutClass = options.compact ? " hbar-layout--compact" : " hbar-layout--wide";
  return `<div class="hbar-list${layoutClass}">${visible
    .map((item) => {
      const metric = `${formatNumber(item.count)} · ${formatPercent(item.percent)}`;
      const width = (item.count / max) * 100;
      return `<div class="hbar" title="${escapeHtml(item.label)}: ${escapeHtml(metric)}">
        <div class="hbar-label hbar-label--wrap">${escapeHtml(item.label)}</div>
        <div class="hbar-track"><span style="width:${width}%"></span></div>
        <div class="hbar-val">${escapeHtml(metric)}</div>
      </div>`;
    })
    .join("")}</div>`;
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
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">${arcs}<circle cx="60" cy="60" r="28" fill="#ffffff"></circle></svg><div class="legend">${legend}</div></div>`;
}

function monthShortLabel(ym) {
  const [y, m] = String(ym).split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return ym;
  const label = `${names[idx]}/${String(y).slice(2)}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
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
