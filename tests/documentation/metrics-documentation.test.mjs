import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DOCUMENTED_METRIC_COUNT,
  METRICS_DOCUMENTATION,
  searchMetricsDocumentation,
} from "../../js/data/metrics-documentation.mjs";
import { PAGE_GROUPS, PAGES } from "../../js/pages.js";
import {
  appUsageConstructionNotice,
  appUsageSourceBanner,
} from "../../js/components/page-kit.mjs";

const expectedSections = [
  "visao-geral",
  "clientes",
  "patrimonio",
  "open-finance",
  "mecanismos",
  "reunioes",
  "formularios",
  "jornada",
  "utilizacao-app",
  "pagamentos",
  "qualidade-dados",
];

test("Documentação é a última página da navegação", () => {
  assert.equal(PAGES.at(-1)?.id, "documentacao");
  assert.equal(PAGES.at(-1)?.implemented, true);
  assert.equal(PAGE_GROUPS.at(-1)?.id, "ajuda");
});

test("registro central cobre as onze páginas com conteúdo suficiente", () => {
  assert.deepEqual(METRICS_DOCUMENTATION.map(({ id }) => id), expectedSections);
  assert.equal(
    DOCUMENTED_METRIC_COUNT,
    METRICS_DOCUMENTATION.reduce((total, section) => total + section.metrics.length, 0),
  );
  assert.ok(DOCUMENTED_METRIC_COUNT >= 80);
  for (const section of METRICS_DOCUMENTATION) {
    assert.ok(section.intro.length >= 30, `introdução insuficiente em ${section.id}`);
    assert.ok(section.metrics.length >= 4, `poucas métricas em ${section.id}`);
    for (const metric of section.metrics) {
      assert.ok(metric.name.length >= 3);
      assert.ok(metric.meaning.length >= 20, `significado insuficiente em ${section.id}/${metric.id}`);
      assert.ok(metric.calculation.length >= 20, `cálculo insuficiente em ${section.id}/${metric.id}`);
    }
  }
});

test("busca encontra nome, página e explicação sem depender de acentos", () => {
  const patrimonio = searchMetricsDocumentation("patrimonio");
  assert.ok(patrimonio.length > 0);
  assert.ok(patrimonio.every(({ pageTitle, name, meaning, calculation }) =>
    [pageTitle, name, meaning, calculation].some((value) => value.toLowerCase().includes("patrim")),
  ));

  const reuniao = searchMetricsDocumentation("reuniao");
  assert.ok(reuniao.some(({ name }) => name === "Realizadas"));
  assert.ok(reuniao.some(({ name }) => name === "Comparecimento"));
  assert.ok(reuniao.some(({ name }) => name === "Nota média"));
});

test("regras ainda não comprovadas ficam explicitamente pendentes", () => {
  const pending = METRICS_DOCUMENTATION.flatMap(({ title, metrics }) =>
    metrics.filter(({ status }) => status === "pending").map((metric) => ({ title, ...metric })),
  );
  assert.ok(pending.some(({ name }) => name === "Situação de uso no App"));
  assert.ok(pending.some(({ name }) => name === "Dívidas na segmentação"));
  assert.ok(pending.some(({ name }) => name === "Retenção"));
  assert.ok(pending.some(({ name }) => name === "Valor pago"));
  assert.ok(pending.every(({ calculation }) => /definição|construção|não disponível/i.test(calculation)));
});

test("Utilização do App comunica fontes GA4, Expo e Pharus", async () => {
  const notice = appUsageConstructionNotice();
  const source = appUsageSourceBanner();
  assert.match(notice, /🔧 Em construção/u);
  assert.match(notice, /Fonte dos dados: Google Analytics \+ Expo \/ EAS \+ App Pharus/);
  assert.match(notice, /O Google Analytics fornece métricas de utilização e comportamento da plataforma/);
  assert.match(notice, /Expo\/EAS complementa com informações técnicas/);
  assert.match(notice, /Os dados do Expo\/EAS podem levar alguns segundos para carregar/);
  assert.doesNotMatch(notice, /Firebase Analytics serão incorporados futuramente/);
  assert.doesNotMatch(notice, /plataforma web|Google Analytics Web|Property Web/i);
  assert.doesNotMatch(notice, /PERMISSION_DENIED|erro técnico|falha ao consultar/i);
  assert.match(source, /Fonte atual dos dados: Expo \/ EAS \+ App Pharus/);

  const [pageSource, viewSource, serviceSource, chartSource, tooltipSource, componentStyles] = await Promise.all([
    readFile(new URL("../../js/pages/utilizacao-app.js", import.meta.url), "utf8"),
    readFile(new URL("../../js/pages/utilizacao-app-view.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../js/services/app-pharus/app-usage.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../js/components/charts.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../js/components/floating-tooltip.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../css/components.css", import.meta.url), "utf8"),
  ]);
  assert.match(serviceSource, /getFirebaseUsagePage/);
  assert.match(serviceSource, /onPartial/);
  assert.match(serviceSource, /loadUsageSources/);
  assert.match(pageSource, /renderUtilizacaoApp/);
  assert.match(pageSource, /bindFloatingTooltips/);
  for (const section of ["1. Utilização da plataforma", "2. Evolução de uso", "3. Engajamento", "4. Principais eventos", "5. Versões do App", "6. Updates e runtime", "7. Builds e deployments", "8. Saúde e performance", "9. Contexto da base Pharus"]) {
    assert.match(viewSource, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(viewSource, /5\. Uso do aplicativo|Usuários únicos por dia|Usuários únicos \(update embarcado\)|sec-expo-usage/);
  assert.doesNotMatch(viewSource, /Uso da plataforma Web|Google Analytics Web|Plataforma detectada/);
  assert.match(viewSource, /não usuários únicos do Google Analytics ou Expo/i);
  assert.match(viewSource, /usageLineChart/);
  assert.match(viewSource, /chartGrid\([^]*, 1\)/);
  assert.match(viewSource, /data-ui-tooltip/);
  assert.doesNotMatch(pageSource, /appUsageSourceBanner/);
  assert.match(chartSource, /bindFloatingTooltips/);
  assert.match(tooltipSource, /window\.addEventListener\("scroll", hideFloatingTooltip, true\)/);
  assert.match(componentStyles, /\.app-usage-kpi-grid\.is-primary[^]*repeat\(3/);
  assert.match(componentStyles, /@media \(max-width: 1100px\)[^]*\.app-usage-kpi-grid[^]*repeat\(2/);
  assert.match(componentStyles, /@media \(max-width: 720px\)[^]*\.app-usage-kpi-grid[^]*grid-template-columns: 1fr/);
  assert.match(componentStyles, /\.chart-grid-full[^]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(componentStyles, /height: clamp\(320px, 31vw, 370px\)/);
  assert.match(componentStyles.match(/\.usage-line-chart \{[^}]+\}/)?.[0] || "", /overflow:\s*visible/);
  assert.match(componentStyles, /\.ui-floating-tooltip \{/);
  assert.doesNotMatch(componentStyles.match(/\.usage-line-chart \{[^}]+\}/)?.[0] || "", /background:\s*(white|black|#fff|#000)/i);
});

test("página de documentação expõe busca e índice interno", async () => {
  const [pageSource, appSource] = await Promise.all([
    readFile(new URL("../../js/pages/documentacao.js", import.meta.url), "utf8"),
    readFile(new URL("../../js/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(pageSource, /data-doc-search/);
  assert.match(pageSource, /data-doc-target/);
  assert.match(pageSource, /searchMetricsDocumentation/);
  assert.match(appSource, /documentacao/);
});
