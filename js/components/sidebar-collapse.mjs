const STORAGE_KEY = "qv:sidebarCollapsed";

export function readSidebarCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export function applySidebarCollapsed(collapsed, { persist = true } = {}) {
  document.body?.classList.toggle("sidebar-collapsed", collapsed);
  if (persist) writeSidebarCollapsed(collapsed);

  const button = document.getElementById("sidebar-collapse-toggle");
  if (!button) return;

  const label = collapsed ? "Mostrar menu lateral" : "Ocultar menu lateral";
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

export function initSidebarCollapse() {
  applySidebarCollapsed(readSidebarCollapsed(), { persist: false });
  const button = document.getElementById("sidebar-collapse-toggle");
  if (!button) return () => {};
  const onClick = () => {
    applySidebarCollapsed(!document.body.classList.contains("sidebar-collapsed"));
  };
  button.addEventListener("click", onClick);
  return () => button.removeEventListener("click", onClick);
}
