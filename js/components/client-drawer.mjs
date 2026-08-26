import { escapeHtml } from "../utils/escape.mjs";
import { formatDate } from "../utils/format.mjs";
import { yesNoBadge } from "./status-badge.mjs";

function pendingOrDate(value) {
  if (!value) return "Regra pendente";
  return formatDate(value);
}

function mechanismCell(client) {
  if (client.hasMechanisms == null) return yesNoBadge(null);
  if (!client.hasMechanisms) return yesNoBadge(false);
  const n = client.mechanismsImplemented;
  if (n == null || n <= 0) return yesNoBadge(true);
  return `${yesNoBadge(true)} <span class="note-muted">${n} implementado${n === 1 ? "" : "s"}</span>`;
}

export function renderClientDrawer(client) {
  if (!client) return "";
  return `
    <div class="drawer-backdrop" data-drawer-close></div>
    <aside class="drawer" role="dialog" aria-labelledby="client-drawer-title">
      <div class="drawer-head">
        <div>
          <p class="eyebrow">Visão 360 do cliente</p>
          <h2 id="client-drawer-title">${escapeHtml(client.name)}</h2>
          <p class="note-muted">${escapeHtml(client.email || client.id)}</p>
        </div>
        <button type="button" class="btn btn-ghost" data-drawer-close>Fechar</button>
      </div>
      <p class="note-muted">Ficha sobre a população oficial. Campos sem regra de negócio aparecem como pendentes; a ausência de um recurso não remove o cliente da base.</p>
      <dl>
        <div><dt>Status</dt><dd>Regra pendente</dd></div>
        <div><dt>Cadastro</dt><dd>${formatDate(client.registeredAt)}</dd></div>
        <div><dt>Responsável</dt><dd>Não informado</dd></div>
        <div><dt>Última atividade</dt><dd>${pendingOrDate(client.lastActivityAt)}</dd></div>
        <div><dt>Patrimônio</dt><dd>${yesNoBadge(client.hasWealth)}</dd></div>
        <div><dt>Open Finance</dt><dd>${yesNoBadge(client.hasOpenFinance)}</dd></div>
        <div><dt>Mecanismos</dt><dd>${mechanismCell(client)}</dd></div>
        <div><dt>Reuniões</dt><dd>${yesNoBadge(client.hasMeetings)}</dd></div>
        <div><dt>Formulários</dt><dd>${yesNoBadge(client.hasForms)}</dd></div>
        <div><dt>Jornada</dt><dd>${escapeHtml(client.journeyStage || "Não informado")}</dd></div>
      </dl>
    </aside>
  `;
}

export function openClientDrawer(client) {
  const root = document.getElementById("overlay-root");
  if (!root) return;
  root.innerHTML = renderClientDrawer(client);
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

export function closeClientDrawer() {
  const root = document.getElementById("overlay-root");
  if (!root) return;
  root.replaceChildren();
  root.setAttribute("aria-hidden", "true");
}
