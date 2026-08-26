const SHOW_AFTER_PX = 320;

export function bootScrollToTop() {
  if (document.getElementById("scroll-top-btn")) return () => {};

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "scroll-top-btn";
  btn.className = "scroll-top-btn";
  btn.hidden = true;
  btn.setAttribute("aria-label", "Voltar ao topo");
  btn.innerHTML = `<span class="scroll-top-icon" aria-hidden="true">↑</span><span class="scroll-top-label">Topo</span>`;
  document.body.appendChild(btn);

  const sync = () => {
    btn.hidden = window.scrollY < SHOW_AFTER_PX;
  };

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  window.addEventListener("scroll", sync, { passive: true });
  sync();
}
