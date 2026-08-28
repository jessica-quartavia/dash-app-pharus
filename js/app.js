import { bootAuth } from "./auth.mjs";
import { bootScrollToTop } from "./components/scroll-to-top.mjs";
import { initTheme } from "./lib/theme.mjs";

initTheme();

let navigationReady = false;

async function startPortal() {
  if (navigationReady) return;
  navigationReady = true;

  const boots = [
    () => import("./pages/visao-geral.js").then((m) => m.bootVisaoGeral()),
    () => import("./pages/clientes.js").then((m) => m.bootClientes()),
    () => import("./pages/patrimonio.js").then((m) => m.bootPatrimonio()),
    () => import("./pages/open-finance.js").then((m) => m.bootOpenFinance()),
    () => import("./pages/mecanismos.js").then((m) => m.bootMecanismos()),
    () => import("./pages/reunioes.js").then((m) => m.bootReunioes()),
    () => import("./pages/formularios.js").then((m) => m.bootFormularios()),
    () => import("./pages/jornada.js").then((m) => m.bootJornada()),
    () => import("./pages/pagamentos.js").then((m) => m.bootPagamentos()),
    () => import("./pages/utilizacao-app.js").then((m) => m.bootUtilizacaoApp()),
    () => import("./pages/qualidade-dados.js").then((m) => m.bootQualidade()),
    () => import("./pages/documentacao.js").then((m) => m.bootDocumentacao()),
  ];

  await Promise.all(
    boots.map(async (boot) => {
      try {
        await boot();
      } catch (error) {
        console.error("[Boot] page failed", error);
      }
    }),
  );

  const { bootNavigation } = await import("./navigation.js");
  bootNavigation();
  document.getElementById("app")?.setAttribute("data-ready", "true");
  bootScrollToTop();
}

document.addEventListener("DOMContentLoaded", () => {
  void bootAuth({
    onAuthenticated: () => {
      void startPortal();
    },
    onSignedOut: () => {
      navigationReady = false;
    },
  });
});
