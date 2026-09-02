const HOST_ID = "ui-tooltip-host";
const VIEWPORT_MARGIN = 8;
const TOOLTIP_GAP = 12;

export function computeTooltipPosition({
  anchor,
  tooltipWidth = 0,
  tooltipHeight = 0,
  viewportWidth = 0,
  viewportHeight = 0,
  margin = VIEWPORT_MARGIN,
  gap = TOOLTIP_GAP,
} = {}) {
  const vw = Number(viewportWidth) || 0;
  const vh = Number(viewportHeight) || 0;
  const width = Math.min(Math.max(Number(tooltipWidth) || 0, 0), Math.max(0, vw - margin * 2));
  const height = Math.max(Number(tooltipHeight) || 0, 0);
  const rect = anchor || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  const centerX = rect.left + rect.width / 2;
  const spaceAbove = rect.top - margin;
  const spaceBelow = vh - rect.bottom - margin;
  const fitsAbove = spaceAbove >= height + gap;
  const placement = fitsAbove || spaceAbove >= spaceBelow ? "top" : "bottom";
  let top = placement === "top" ? rect.top - gap - height : rect.bottom + gap;
  let left = centerX - width / 2;
  if (left + width > vw - margin) left = vw - margin - width;
  if (left < margin) left = margin;
  if (top + height > vh - margin) top = Math.max(margin, vh - margin - height);
  if (top < margin) top = margin;
  return { left, top, placement, width };
}

export function ensureTooltipHost() {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.className = "ui-tooltip-host";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
  }
  return host;
}

function measureTooltip(node) {
  const previous = node.hidden;
  node.hidden = false;
  const width = node.offsetWidth || 180;
  const height = node.offsetHeight || 48;
  if (previous) node.hidden = true;
  return { width, height };
}

let sharedTooltip = null;
let activeAnchor = null;
let globalBound = false;

function tooltipNode() {
  const host = ensureTooltipHost();
  if (!sharedTooltip) {
    sharedTooltip = document.createElement("div");
    sharedTooltip.className = "ui-floating-tooltip";
    sharedTooltip.setAttribute("role", "tooltip");
    sharedTooltip.hidden = true;
    host.appendChild(sharedTooltip);
  }
  return sharedTooltip;
}

export function hideFloatingTooltip() {
  if (!sharedTooltip) return;
  sharedTooltip.hidden = true;
  sharedTooltip.textContent = "";
  activeAnchor = null;
  ensureTooltipHost().setAttribute("aria-hidden", "true");
}

export function showFloatingTooltip(anchor, text) {
  if (!anchor || !text) return hideFloatingTooltip();
  const node = tooltipNode();
  node.textContent = text;
  node.hidden = false;
  const size = measureTooltip(node);
  const position = computeTooltipPosition({
    anchor: anchor.getBoundingClientRect(),
    tooltipWidth: size.width,
    tooltipHeight: size.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  node.dataset.placement = position.placement;
  node.style.left = `${position.left}px`;
  node.style.top = `${position.top}px`;
  activeAnchor = anchor;
  ensureTooltipHost().setAttribute("aria-hidden", "false");
}

function bindGlobalDismiss() {
  if (globalBound || typeof document === "undefined") return;
  globalBound = true;
  document.addEventListener("pointerdown", (event) => {
    if (!activeAnchor) return;
    const target = event.target;
    if (target?.closest?.("[data-line-point], [data-ui-tooltip], .ui-floating-tooltip")) return;
    hideFloatingTooltip();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideFloatingTooltip();
  });
  window.addEventListener("scroll", hideFloatingTooltip, true);
  window.addEventListener("resize", hideFloatingTooltip);
}

function isFinePointer() {
  return typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
}

export function bindFloatingTooltips(root = document) {
  if (!root?.querySelectorAll) return;
  bindGlobalDismiss();

  const bindAnchor = (anchor, getText) => {
    if (anchor.dataset.tooltipBound === "true") return;
    anchor.dataset.tooltipBound = "true";
    anchor.addEventListener("mouseenter", () => showFloatingTooltip(anchor, getText()));
    anchor.addEventListener("mouseleave", hideFloatingTooltip);
    anchor.addEventListener("focus", () => showFloatingTooltip(anchor, getText()));
    anchor.addEventListener("blur", hideFloatingTooltip);
    anchor.addEventListener("click", (event) => {
      if (isFinePointer()) return;
      event.preventDefault();
      event.stopPropagation();
      if (activeAnchor === anchor) hideFloatingTooltip();
      else showFloatingTooltip(anchor, getText());
    });
  };

  root.querySelectorAll("[data-line-point]").forEach((point) => {
    bindAnchor(point, () => point.getAttribute("data-tooltip") || "");
  });
  root.querySelectorAll("[data-ui-tooltip]").forEach((trigger) => {
    bindAnchor(trigger, () => trigger.getAttribute("data-ui-tooltip") || trigger.getAttribute("aria-label") || "");
  });
}
