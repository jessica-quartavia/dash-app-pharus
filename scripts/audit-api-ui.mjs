/** Compara os payloads backend com os presenters usados pela UI, sem imprimir entidades. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { buildOverview } from "../lib/app-pharus/overview.mjs";
import { buildClientsDataset } from "../lib/app-pharus/clients-page.mjs";
import { presentClientsPage } from "../lib/app-pharus/present-clients.mjs";
import { buildMechanismsDataset } from "../lib/app-pharus/mechanisms-page.mjs";
import { presentMechanismsPage } from "../lib/app-pharus/present-mechanisms.mjs";
import { DOMAIN_BUILDERS } from "../lib/app-pharus/domain-pages.mjs";
import { presentFormsPage, presentJourneyPage, presentMeetingsPage, presentOpenFinancePage, presentPaymentsPage, presentWealthPage } from "../lib/app-pharus/domain-presenters.mjs";
import { buildExpoUsageDataset } from "../lib/expo/usage-page.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(root);
const filters = { period: "all", search: "", advisor: "all", openFinance: "all", hasWealth: "all", hasMechanisms: "all", journeyStage: "all", segment: "all" };
const compactKpis = (items) => Object.fromEntries((items || []).map((item) => [item.label, item.value]));

const clientsDataset = await buildClientsDataset({ force: true });
const overview = await buildOverview();
const mechanismsDataset = await buildMechanismsDataset();
const journeyData = await DOMAIN_BUILDERS.journey();
const meetingsData = await DOMAIN_BUILDERS.meetings();
const wealthData = await DOMAIN_BUILDERS.wealth();
const openFinanceData = await DOMAIN_BUILDERS["open-finance"]();
const formsData = await DOMAIN_BUILDERS.forms();
const paymentsData = await DOMAIN_BUILDERS.payments();
const usageContext = await DOMAIN_BUILDERS["usage-context"]();
const expo = await buildExpoUsageDataset({});

const pages = {
  overview: { api: compactKpis(overview.kpis), ui: compactKpis(overview.kpis) },
  clients: { apiRows: clientsDataset.clients.length, uiRows: presentClientsPage(clientsDataset, filters).rows.length },
  mechanisms: { apiRows: mechanismsDataset.clients.length, ui: compactKpis(presentMechanismsPage(mechanismsDataset, filters).kpis) },
  journey: { apiRows: journeyData.clients.length, ui: compactKpis(presentJourneyPage(journeyData, filters).kpis) },
  meetings: { apiRows: meetingsData.rows.length, ui: compactKpis(presentMeetingsPage(meetingsData, filters).kpis) },
  wealth: { apiRows: wealthData.rows.length, ui: compactKpis(presentWealthPage(wealthData, filters).kpis) },
  openFinance: { apiRows: openFinanceData.rows.length, ui: compactKpis(presentOpenFinancePage(openFinanceData, filters).kpis) },
  forms: { apiRows: formsData.rows.length, ui: compactKpis(presentFormsPage(formsData, filters).kpis) },
  payments: { apiRows: paymentsData.rows.length, ui: compactKpis(presentPaymentsPage(paymentsData, filters).kpis), amountAvailable: paymentsData.amountAvailable },
  appUsage: { expoAvailable: expo.available, expoBuilds: expo.builds?.length || 0, expoChannels: expo.channels?.length || 0, expoUsageSeries: expo.usageSeries?.length || 0, pharusContext: compactKpis(usageContext.kpis), individualLink: usageContext.individualExpoLinkConfirmed },
};

console.log(JSON.stringify({ population: clientsDataset.populationTotal, pages }, null, 2));
