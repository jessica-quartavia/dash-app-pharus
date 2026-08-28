import { authenticatedFetch } from "../../auth.mjs";
import { readApiJson } from "../../lib/api-json.mjs";
import { presentFormsPage, presentJourneyPage, presentMeetingsPage, presentOpenFinancePage, presentPaymentsPage, presentWealthPage } from "../../../lib/app-pharus/domain-presenters.mjs";

const cache = new Map();
const TTL_MS = 60_000;
const presenters = { journey: presentJourneyPage, meetings: presentMeetingsPage, wealth: presentWealthPage, "open-finance": presentOpenFinancePage, forms: presentFormsPage, payments: presentPaymentsPage };

async function getDomainDataset(domain, { force = false } = {}) {
  const cached = cache.get(domain);
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.data;
  const response = await authenticatedFetch(`/api/dashboard?domain=${encodeURIComponent(domain)}`, { cache: "no-store" });
  const data = await readApiJson(response, `Não foi possível carregar ${domain}.`);
  cache.set(domain, { at: Date.now(), data });
  return data;
}

export async function getDomainPage(domain, filters, options = {}) {
  const dataset = await getDomainDataset(domain, options);
  return presenters[domain](dataset, filters);
}

export const getJourneyPage = (filters, options) => getDomainPage("journey", filters, options);
export const getMeetingsPage = (filters, options) => getDomainPage("meetings", filters, options);
export const getWealthPage = (filters, options) => getDomainPage("wealth", filters, options);
export const getOpenFinancePage = (filters, options) => getDomainPage("open-finance", filters, options);
export const getFormsPage = (filters, options) => getDomainPage("forms", filters, options);
export const getPaymentsPage = (filters, options) => getDomainPage("payments", filters, options);
