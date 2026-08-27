const THEME_KEY = "pharus_theme";

export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme = getTheme()) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  const button = document.querySelector("[data-theme-toggle]");
  button?.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
  button?.setAttribute("aria-label", next === "dark" ? "Ativar tema Light" : "Ativar tema Dark");
  button?.setAttribute("title", next === "dark" ? "Ativar tema Light" : "Ativar tema Dark");
  const label = button?.querySelector("[data-theme-label]");
  if (label) label.textContent = next === "dark" ? "Dark" : "Light";
  return next;
}

export function initTheme() {
  return applyTheme(getTheme());
}

export function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
  return applyTheme(next);
}

export function mountThemeToggle(host) {
  if (!host || host.dataset.themeBound) return;
  host.dataset.themeBound = "true";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";
  button.dataset.themeToggle = "true";
  button.innerHTML = `<span class="theme-toggle-icon theme-toggle-icon-sun" aria-hidden="true">☀</span><span class="theme-toggle-icon theme-toggle-icon-moon" aria-hidden="true">☾</span><span class="theme-toggle-label" data-theme-label>Light</span>`;
  button.addEventListener("click", () => toggleTheme());
  host.appendChild(button);
  applyTheme();
}
