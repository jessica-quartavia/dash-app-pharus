import {
  DEFAULT_PAGE_ID,
  PAGE_GROUPS,
  getPageById,
  getPagesByGroup,
  isPageImplemented,
  resolvePageFromHash,
} from "./pages.js";
import { initSidebarCollapse } from "./components/sidebar-collapse.mjs";
import { navIcon } from "./nav-icons.mjs";

const INTENDED_HASH_KEY = "qv:intendedHash";

let currentPageId = DEFAULT_PAGE_ID;
let navBound = false;
const openNavGroups = new Set(PAGE_GROUPS.map((group) => group.id));

function consumeIntendedHash() {
  try {
    const stored = sessionStorage.getItem(INTENDED_HASH_KEY);
    if (stored) sessionStorage.removeItem(INTENDED_HASH_KEY);
    if (stored && stored.replace(/^#/, "").trim()) return stored;
  } catch {
    /* ignore */
  }
  return window.location.hash;
}

export function getCurrentPageId() {
  return currentPageId;
}

function setDocumentTitle(page) {
  document.title = `${page.title} · Dash App Pharus`;
}

function updatePageChrome(page) {
  const eyebrow = document.getElementById("page-eyebrow");
  const title = document.getElementById("page-title");
  const description = document.getElementById("page-description");
  const view = document.getElementById("page-view");

  if (eyebrow) eyebrow.textContent = page.eyebrow;
  if (title) title.textContent = page.title;
  if (description) description.textContent = page.description;
  if (view) view.dataset.page = page.id;

  document.querySelectorAll("[data-page-nav]").forEach((button) => {
    const active = button.dataset.pageNav === page.id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });

  syncNavGroupForPage(page);
}

function syncNavGroupForPage(page) {
  if (!page?.group) return;
  openNavGroups.add(page.group);
  document.querySelectorAll(".nav-group[data-group-id]").forEach((section) => {
    const groupId = section.dataset.groupId;
    const expanded = openNavGroups.has(groupId);
    section.classList.toggle("is-open", expanded);
    const toggle = section.querySelector(".nav-group-toggle");
    const list = section.querySelector(".nav-list");
    if (toggle) toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (list) list.hidden = !expanded;
  });
}

function toggleNavGroup(groupId) {
  if (openNavGroups.has(groupId)) openNavGroups.delete(groupId);
  else openNavGroups.add(groupId);
  const section = document.querySelector(`.nav-group[data-group-id="${groupId}"]`);
  if (!section) return;
  const expanded = openNavGroups.has(groupId);
  section.classList.toggle("is-open", expanded);
  const toggle = section.querySelector(".nav-group-toggle");
  const list = section.querySelector(".nav-list");
  if (toggle) toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  if (list) list.hidden = !expanded;
}

export function navigateTo(pageId, { updateHash = true } = {}) {
  const page = getPageById(pageId) || getPageById(DEFAULT_PAGE_ID);
  currentPageId = page.id;
  updatePageChrome(page);
  setDocumentTitle(page);

  if (updateHash) {
    const nextHash = `#${page.hash}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState({ page: page.id }, "", nextHash);
    }
  }

  closeMobileNav();
  document.dispatchEvent(new CustomEvent("page:navigate", { detail: { pageId: page.id } }));
  if (!isPageImplemented(page.id)) {
    const content = document.getElementById("page-content");
    if (content) {
      content.innerHTML = '<p class="placeholder-note">Esta página ainda não foi implementada.</p>';
    }
  }
}

function renderSidebar() {
  const nav = document.getElementById("sidebar-nav");
  if (!nav) return;
  nav.replaceChildren();

  for (const group of PAGE_GROUPS) {
    const pages = getPagesByGroup(group.id);
    if (!pages.length) continue;

    const section = document.createElement("section");
    section.className = "nav-group is-open";
    section.dataset.groupId = group.id;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-group-toggle";
    toggle.setAttribute("aria-expanded", "true");
    toggle.innerHTML = `<span class="nav-group-chevron" aria-hidden="true"></span><span class="nav-group-text">${group.label}</span>`;

    const list = document.createElement("ul");
    list.className = "nav-list";

    for (const page of pages) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nav-item";
      button.dataset.pageNav = page.id;
      button.innerHTML = `${navIcon(page.id)}<span>${page.navLabel}</span>`;
      item.appendChild(button);
      list.appendChild(item);
    }

    section.append(toggle, list);
    nav.appendChild(section);
  }

  syncNavGroupForPage(getPageById(currentPageId));
}

function closeMobileNav() {
  document.body.classList.remove("nav-open");
  document.getElementById("nav-toggle")?.setAttribute("aria-expanded", "false");
}

export function bootNavigation() {
  renderSidebar();
  initSidebarCollapse();

  if (!navBound) {
    navBound = true;
    document.getElementById("sidebar-nav")?.addEventListener("click", (event) => {
      const groupToggle = event.target.closest(".nav-group-toggle");
      if (groupToggle) {
        const section = groupToggle.closest(".nav-group");
        if (section?.dataset.groupId) toggleNavGroup(section.dataset.groupId);
        return;
      }
      const button = event.target.closest("[data-page-nav]");
      if (!button) return;
      navigateTo(button.dataset.pageNav);
    });

    document.getElementById("nav-toggle")?.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      document.getElementById("nav-toggle")?.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.getElementById("nav-backdrop")?.addEventListener("click", closeMobileNav);
    window.addEventListener("hashchange", () => {
      navigateTo(resolvePageFromHash(window.location.hash).id, { updateHash: false });
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMobileNav();
    });
  }

  navigateTo(resolvePageFromHash(consumeIntendedHash()).id);
}
