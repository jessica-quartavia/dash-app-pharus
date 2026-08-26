/**
 * Apresentação da página Mecanismos (browser + servidor).
 * Não importa Auth Admin nem PostgREST.
 */
import { filterClients } from "../../js/lib/filters/apply.mjs";
import { formatPercent, percentOf } from "../../js/utils/format.mjs";
import {
  byCategory,
  byMechanism,
  lastImplementedAt,
  monthlyImplementations,
  qtyDistribution,
} from "./mechanisms.mjs";

function okKpi(key, label, value, note, extra = {}) {
  return { key, label, status: "ok", value, note, ...extra };
}

function coverageNote(part, total) {
  if (!total) return "Sem clientes no recorte.";
  return `${formatPercent(percentOf(part, total))} da base`;
}

function sortClientsForTable(clients) {
  return [...(clients || [])].sort((a, b) => {
    const diff = (Number(b.mechanismsImplemented) || 0) - (Number(a.mechanismsImplemented) || 0);
    if (diff !== 0) return diff;
    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
  });
}

export function presentMechanismsPage(payload, filters = {}) {
  const catalog = payload.catalog || [];
  const available = catalog.length;
  const all = payload.clients || [];
  const recorte = filterClients(all, filters, { dateField: "registeredAt" });
  const recorteIds = new Set(recorte.map((client) => String(client.id)));
  const implementations = (payload.implementations || []).filter((row) => recorteIds.has(String(row.user_id)));
  const withMech = recorte.filter((client) => client.hasMechanisms);
  const without = Math.max(0, recorte.length - withMech.length);
  const coverage = percentOf(withMech.length, recorte.length);
  const counts = new Map(recorte.map((client) => [client.id, Number(client.mechanismsImplemented) || 0]));
  const last = lastImplementedAt(implementations);
  const officialTotal = payload.populationTotal ?? payload.clientBase?.total ?? all.length;
  const average =
    withMech.length > 0 ? Math.round(implementations.length / withMech.length) : 0;

  return {
    kpis: [
      okKpi(
        "with",
        "Clientes com mecanismos",
        withMech.length,
        coverageNote(withMech.length, recorte.length),
        { primary: true },
      ),
      okKpi(
        "implementations",
        "Implementações",
        implementations.length,
        "Mecanismos implementados pelos clientes do recorte",
      ),
      okKpi(
        "coverage",
        "Cobertura de clientes",
        coverage,
        `${withMech.length} de ${recorte.length} clientes do recorte`,
        { kind: "percent" },
      ),
      okKpi("available", "Mecanismos disponíveis", available, "Catálogo de mecanismos do App"),
      okKpi(
        "average",
        "Média de mecanismos por cliente",
        average,
        "Média entre clientes com mecanismos",
      ),
      okKpi("without", "Clientes sem mecanismos", without, "Ainda sem mecanismos implementados"),
      okKpi("last", "Último implementado", last, "Data mais recente de implementação no recorte", {
        kind: "date",
      }),
    ],
    byMechanism: byMechanism(implementations, catalog, recorte.length),
    byCategory: byCategory(implementations, catalog),
    monthly: monthlyImplementations(implementations),
    qtyDist: qtyDistribution(counts, recorte.length),
    rows: sortClientsForTable(recorte),
    clientBase: payload.clientBase,
    methodology: payload.methodology,
    officialTotal,
    populationTotal: officialTotal,
    recorteTotal: recorte.length,
    filteredTotal: recorte.length,
  };
}
