import { escapeHtml } from "../utils/escape.mjs";
import { formatDate, formatNumber } from "../utils/format.mjs";
import { closeClientDrawer } from "./client-drawer.mjs";

export function renderMechanismDrawer(client) {
  if (!client) return "";
  const count = Number(client.mechanismsImplemented) || 0;
  const mechanisms = client.mechanisms || [];
  const list =
    mechanisms.length > 0
      ? `<ul class="mechanism-drawer-list">${mechanisms
          .map(
            (item) => `<li class="mechanism-drawer-item">
              <div class="mechanism-drawer-item-head">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="note-muted">${escapeHtml(item.category || "Não informado")}</span>
              </div>
              ${item.implementedAt ? `<p class="mechanism-drawer-date">Implementado em ${formatDate(item.implementedAt)}</p>` : ""}
              ${item.description ? `<p class="mechanism-drawer-desc">${escapeHtml(item.description)}</p>` : ""}
            </li>`,
          )
          .join("")}</ul>`
      : `<p class="placeholder-note">Nenhum mecanismo implementado</p>`;

  return `
    <div class="drawer-backdrop" data-drawer-close></div>
    <aside class="drawer drawer-mechanisms" role="dialog" aria-labelledby="mechanism-drawer-title">
      <div class="drawer-head">
        <div>
          <p class="eyebrow">Mecanismos do cliente</p>
          <h2 id="mechanism-drawer-title">${escapeHtml(client.name)}</h2>
          <p class="note-muted">${escapeHtml(client.email || client.id)}</p>
          <p class="mechanism-drawer-count">${formatNumber(count)} mecanismo${count === 1 ? "" : "s"} implementado${count === 1 ? "" : "s"}</p>
        </div>
        <button type="button" class="btn btn-ghost" data-drawer-close>Fechar</button>
      </div>
      <section class="mechanism-drawer-section">
        <h3>Mecanismos implementados</h3>
        ${list}
      </section>
    </aside>
  `;
}

export function openMechanismDrawer(client) {
  const root = document.getElementById("overlay-root");
  if (!root) return;
  root.innerHTML = renderMechanismDrawer(client);
  root.setAttribute("aria-hidden", "false");
  const close = () => closeClientDrawer();
  root.querySelectorAll("[data-drawer-close]").forEach((el) => {
    el.addEventListener("click", close);
  });
  const onKey = (event) => {
    if (event.key === "Escape") closeClientDrawer();
  };
  document.addEventListener("keydown", onKey, { once: true });
}
