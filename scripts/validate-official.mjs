/**
 * Validação read-only: população oficial, Tier e filtro EP (MCP vs API).
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { buildClientsDataset, presentClientsPage } from "../lib/app-pharus/clients-page.mjs";
import { buildMechanismsDataset, presentMechanismsPage } from "../lib/app-pharus/mechanisms-page.mjs";
import { tierDistribution } from "../lib/app-pharus/segmentation.mjs";
import { OFFICIAL_CLIENT_RULE } from "../lib/app-pharus/clients.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(ROOT);

const EP_FELIPE = {
  internal_id: "e53e70b7-94a2-4c18-a1ec-7afa2354d23b",
  name: "Felipe Aleixo",
};

function chartToMap(chart) {
  return Object.fromEntries((chart || []).map((item) => [item.label, item.count]));
}

async function main() {
  const clientsDataset = await buildClientsDataset();
  const page = presentClientsPage(clientsDataset, { period: "all" });
  const chart = tierDistribution(page.rows);
  const tiers = chartToMap(chart);

  const officialTotal = clientsDataset.populationTotal ?? clientsDataset.clientBase?.total ?? page.rows.length;
  // More accurate: no engine row = tierReasons without income and dados insuficientes from missing engine
  const noEngine = page.rows.filter((c) => c.tierReasons?.some((r) => r.includes("Sem renda")) && c.tierIncome == null && c.tierReserve == null && c.tierContribution == null).length;

  const mechDataset = await buildMechanismsDataset();
  const mechAll = presentMechanismsPage(mechDataset, { period: "all", advisor: "all" });
  const mechEp = presentMechanismsPage(mechDataset, { period: "all", advisor: EP_FELIPE.internal_id });
  const epOption = (mechAll.advisors || []).find((item) => item.id === EP_FELIPE.internal_id);

  const tierSum =
    (tiers["Tier 1"] || 0) +
    (tiers["Tier 2"] || 0) +
    (tiers["Tier 3"] || 0) +
    (tiers["Tier 4"] || 0) +
    (tiers["Dados insuficientes"] || 0);

  console.log(
    JSON.stringify(
      {
        rule: OFFICIAL_CLIENT_RULE.sql,
        segmentation: {
          api: {
            officialTotal,
            clientsLoaded: page.rows.length,
            tierSum,
            tiersMatchTotal: tierSum === page.rows.length,
            withEnginesApprox: page.rows.length - noEngine,
            withoutEngines: noEngine,
            tier_1: tiers["Tier 1"] || 0,
            tier_2: tiers["Tier 2"] || 0,
            tier_3: tiers["Tier 3"] || 0,
            tier_4: tiers["Tier 4"] || 0,
            dados_insuficientes: tiers["Dados insuficientes"] || 0,
            segmentChart: chart,
          },
        },
        epFilter: {
          ep: EP_FELIPE,
          advisorOptionCount: epOption?.count ?? null,
          api: {
            recorteTotal: mechEp.recorteTotal,
            withMechanisms: mechEp.kpis.find((k) => k.key === "with")?.value,
            withoutMechanisms: mechEp.kpis.find((k) => k.key === "without")?.value,
            implementations: mechEp.kpis.find((k) => k.key === "implementations")?.value,
            coverage: mechEp.kpis.find((k) => k.key === "coverage")?.value,
            tableRows: mechEp.rows.length,
          },
          allPopulation: mechAll.recorteTotal,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
