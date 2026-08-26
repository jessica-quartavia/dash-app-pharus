/**
 * Portal de overlays — popovers fora do fluxo da página para não serem cortados.
 */
export const OVERLAY_ROOT_ID = "overlay-root";
export const VIEWPORT_MARGIN = 12;
export const MOBILE_BREAKPOINT = 720;
export const POPOVER_GAP = 8;

export function ensureOverlayRoot() {
  let root = document.getElementById(OVERLAY_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = OVERLAY_ROOT_ID;
    root.className = "overlay-root";
    root.setAttribute("aria-hidden", "true");
    document.body.appendChild(root);
  }
  return root;
}

export function computePopoverPosition({
  anchorRect,
  popoverWidth,
  popoverHeight,
  viewportWidth,
  viewportHeight,
  margin = VIEWPORT_MARGIN,
  gap = POPOVER_GAP,
  mobileBreakpoint = MOBILE_BREAKPOINT,
} = {}) {
  const vw = Number(viewportWidth) || 0;
  const vh = Number(viewportHeight) || 0;
  const width = Math.min(Number(popoverWidth) || 320, Math.max(0, vw - margin * 2));
  const height = Number(popoverHeight) || 420;

  if (vw > 0 && vw <= mobileBreakpoint) {
    return {
      mode: "mobile",
      top: null,
      left: margin,
      right: margin,
      bottom: margin,
      width: Math.max(0, vw - margin * 2),
      placement: "sheet",
    };
  }

  if (!anchorRect) {
    return { mode: "desktop", top: margin, left: margin, width, placement: "bottom" };
  }

  let top = anchorRect.bottom + gap;
  let left = anchorRect.left;
  let placement = "bottom";
  if (left + width > vw - margin) left = Math.max(margin, vw - margin - width);
  if (left < margin) left = margin;

  const spaceBelow = vh - anchorRect.bottom - gap;
  const spaceAbove = anchorRect.top - gap;
  if (height > spaceBelow && spaceAbove > spaceBelow) {
    top = anchorRect.top - gap - height;
    placement = "top";
  }
  if (top < margin) top = margin;
  if (top + height > vh - margin) top = Math.max(margin, vh - margin - height);

  return { mode: "desktop", top, left, width, placement };
}

function applyPopoverPosition(popover, position) {
  if (!popover || !position) return;
  popover.classList.toggle("drp-popover--mobile", position.mode === "mobile");
  if (position.mode === "mobile") {
    popover.style.top = "auto";
    popover.style.left = `${position.left}px`;
    popover.style.right = `${position.right}px`;
    popover.style.bottom = `${position.bottom}px`;
    popover.style.width = "auto";
    return;
  }
  popover.style.top = `${position.top}px`;
  popover.style.left = `${position.left}px`;
  popover.style.right = "";
  popover.style.bottom = "";
  popover.style.width = `${position.width}px`;
}

function measurePopoverSize(popover, fallbackWidth = 320, fallbackHeight = 420) {
  if (!popover) return { width: fallbackWidth, height: fallbackHeight };
  const wasHidden = popover.hidden;
  const prevVisibility = popover.style.visibility;
  popover.hidden = false;
  popover.style.visibility = "hidden";
  const width = popover.offsetWidth || fallbackWidth;
  const height = popover.offsetHeight || fallbackHeight;
  popover.style.visibility = prevVisibility;
  if (wasHidden) popover.hidden = true;
  return { width, height };
}

export function positionAnchoredPopover({ anchor, popover, viewport = null }) {
  const rect = anchor?.getBoundingClientRect?.();
  const size = measurePopoverSize(popover);
  const position = computePopoverPosition({
    anchorRect: rect,
    popoverWidth: size.width,
    popoverHeight: size.height,
    viewportWidth: viewport?.width ?? window.innerWidth,
    viewportHeight: viewport?.height ?? window.innerHeight,
  });
  applyPopoverPosition(popover, position);
  return position;
}

export function mountPopoverPortal({ anchor, popover, overlayRoot, onDismiss }) {
  const root = overlayRoot || ensureOverlayRoot();
  const backdrop = document.createElement("div");
  backdrop.className = "drp-backdrop";
  backdrop.dataset.drpBackdrop = "";
  backdrop.setAttribute("aria-hidden", "true");
  const dismiss = (event) => {
    event?.preventDefault?.();
    onDismiss?.(event);
  };
  backdrop.addEventListener("pointerdown", dismiss);
  root.appendChild(backdrop);
  if (popover.parentNode !== root) root.appendChild(popover);
  root.setAttribute("aria-hidden", "false");
  popover.hidden = false;
  popover.classList.add("drp-popover--portal");
  const position = positionAnchoredPopover({ anchor, popover });
  return { overlayRoot: root, backdrop, position };
}

export function unmountPopoverPortal({ overlayRoot, backdrop, popover } = {}) {
  backdrop?.remove?.();
  if (popover) {
    popover.hidden = true;
    popover.classList.remove("drp-popover--portal", "drp-popover--mobile");
    popover.style.top = "";
    popover.style.left = "";
    popover.style.right = "";
    popover.style.bottom = "";
    popover.style.width = "";
    popover.style.visibility = "";
  }
  const root = overlayRoot || document.getElementById(OVERLAY_ROOT_ID);
  if (root && !root.querySelector("[data-drp-backdrop]") && ![...root.children].some((node) => node.dataset?.drpPopover != null && !node.hidden)) {
    root.setAttribute("aria-hidden", "true");
  }
}
