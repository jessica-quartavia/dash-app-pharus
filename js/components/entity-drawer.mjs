/** Drawer lateral reutilizável (fechar por X, ESC ou backdrop). */
export function openEntityDrawer(html) {
  const root = document.getElementById("overlay-root");
  if (!root) return;
  root.innerHTML = html;
  root.setAttribute("aria-hidden", "false");
  const close = () => closeEntityDrawer();
  root.querySelectorAll("[data-drawer-close]").forEach((el) => {
    el.addEventListener("click", close);
  });
  document.addEventListener("keydown", onEscape, { once: true });

  function onEscape(event) {
    if (event.key === "Escape") closeEntityDrawer();
  }
}

export function closeEntityDrawer() {
  const root = document.getElementById("overlay-root");
  if (!root) return;
  root.replaceChildren();
  root.setAttribute("aria-hidden", "true");
}

export function drawerShell({ eyebrow, title, subtitle, body, className = "" }) {
  return `
    <div class="drawer-backdrop" data-drawer-close></div>
    <aside class="drawer ${className}" role="dialog" aria-modal="true" aria-labelledby="entity-drawer-title">
      <div class="drawer-head">
        <div>
          ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}
          <h2 id="entity-drawer-title">${title}</h2>
          ${subtitle ? `<p class="note-muted">${subtitle}</p>` : ""}
        </div>
        <button type="button" class="btn btn-ghost" data-drawer-close aria-label="Fechar">Fechar</button>
      </div>
      ${body}
    </aside>
  `;
}
