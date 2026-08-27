const STICKY_KEY = "pharus_sticky_filters";

export function isStickyFiltersEnabled() {
  try {
    return localStorage.getItem(STICKY_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setStickyFiltersEnabled(enabled) {
  try {
    localStorage.setItem(STICKY_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
  syncStickyFiltersClass();
}

export function syncStickyFiltersClass() {
  const el = document.getElementById("page-filters");
  if (!el) return;
  el.classList.toggle("is-sticky-pinned", isStickyFiltersEnabled());
}
