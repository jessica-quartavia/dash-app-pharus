import { escapeHtml } from "../utils/escape.mjs";

export const EXPANDABLE_CHART_LIMIT = 8;

const boundRoots = new WeakSet();

export function expandableChartViewModel(total, expanded = false, limit = EXPANDABLE_CHART_LIMIT) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeLimit = Math.max(1, Number(limit) || EXPANDABLE_CHART_LIMIT);
  const canExpand = safeTotal > safeLimit;
  const isExpanded = canExpand && Boolean(expanded);
  const visibleCount = isExpanded ? safeTotal : Math.min(safeTotal, safeLimit);
  return {
    canExpand,
    expanded: isExpanded,
    hiddenCount: safeTotal - visibleCount,
    limit: safeLimit,
    total: safeTotal,
    visibleCount,
  };
}

export function renderExpandableChartList(itemMarkup, {
  contentClass = "",
  limit = EXPANDABLE_CHART_LIMIT,
} = {}) {
  const items = Array.isArray(itemMarkup) ? itemMarkup : [];
  const state = expandableChartViewModel(items.length, false, limit);
  const contentClasses = ["expandable-chart-content", contentClass].filter(Boolean).join(" ");
  const renderedItems = items.map((markup, index) =>
    `<div class="expandable-chart-item" data-expandable-item${index >= state.limit ? " hidden" : ""}>${markup}</div>`,
  ).join("");

  if (!state.canExpand) return `<div class="${escapeHtml(contentClass)}">${items.join("")}</div>`;

  return `<div class="expandable-chart-list" data-expandable-chart data-expanded="false" data-limit="${state.limit}">
    <div class="${escapeHtml(contentClasses)}" data-expandable-content>${renderedItems}</div>
    <div class="expandable-chart-footer">
      <span class="expandable-chart-summary" data-expandable-summary>${state.visibleCount} visíveis de ${state.total}</span>
      <button class="expandable-chart-toggle" type="button" data-expandable-toggle aria-expanded="false">
        <span data-expandable-label>Ver mais (${state.hiddenCount})</span>
        <span class="expandable-chart-chevron" aria-hidden="true">⌄</span>
      </button>
    </div>
  </div>`;
}

function updateExpandableText(container, state) {
  const button = container.querySelector("[data-expandable-toggle]");
  const label = container.querySelector("[data-expandable-label]");
  const summary = container.querySelector("[data-expandable-summary]");
  if (button) button.setAttribute("aria-expanded", state.expanded ? "true" : "false");
  if (label) label.textContent = state.expanded ? "Ver menos" : `Ver mais (${state.hiddenCount})`;
  if (summary) summary.textContent = `${state.visibleCount} visíveis de ${state.total}`;
}

export function setExpandableChartExpanded(container, expanded) {
  if (!container) return;
  const content = container.querySelector("[data-expandable-content]");
  const items = [...container.querySelectorAll("[data-expandable-item]")];
  const limit = Number(container.dataset.limit) || EXPANDABLE_CHART_LIMIT;
  const state = expandableChartViewModel(items.length, expanded, limit);
  if (!content || !state.canExpand) return;

  const previousHeight = content.getBoundingClientRect().height;
  content.style.height = `${previousHeight}px`;
  container.classList.toggle("is-expanded", state.expanded);
  container.dataset.expanded = state.expanded ? "true" : "false";
  items.slice(limit).forEach((item) => { item.hidden = !state.expanded; });
  updateExpandableText(container, state);

  const nextHeight = content.scrollHeight;
  const schedule = container.ownerDocument?.defaultView?.requestAnimationFrame || ((callback) => callback());
  content.getBoundingClientRect();
  schedule(() => {
    content.style.height = `${nextHeight}px`;
  });
  content.addEventListener("transitionend", () => {
    content.style.height = "auto";
  }, { once: true });
}

export function bindExpandableChartLists(root = document) {
  if (!root || boundRoots.has(root)) return;
  boundRoots.add(root);
  root.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-expandable-toggle]");
    if (!button || !root.contains(button)) return;
    const container = button.closest("[data-expandable-chart]");
    setExpandableChartExpanded(container, container?.dataset.expanded !== "true");
  });
}
