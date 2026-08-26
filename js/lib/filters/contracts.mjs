import { DATE_RANGE_PRESETS } from "./period.mjs";
import { OFFICIAL_JOURNEY_STAGES } from "../../../lib/app-pharus/clients.mjs";
import { ADVISORS, CLIENT_STATUSES, JOURNEY_STAGES } from "../../data/mocks/catalogs.mjs";

const yesNo = [
  { value: "all", label: "Todos" },
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
];

export function periodField() {
  return {
    id: "filter-period",
    key: "period",
    kind: "period",
    label: "Período",
    fromId: "filter-start-date",
    toId: "filter-end-date",
  };
}

export function searchField() {
  return { id: "filter-search", key: "search", kind: "search", label: "Busca" };
}

export function statusField() {
  return {
    id: "filter-status",
    key: "status",
    kind: "select",
    label: "Status",
    options: [{ value: "all", label: "Todos" }, ...CLIENT_STATUSES.map((value) => ({ value, label: value }))],
  };
}

export function openFinanceField() {
  return { id: "filter-of", key: "openFinance", kind: "select", label: "Open Finance", options: yesNo };
}

export function mechanismsField() {
  return { id: "filter-mech", key: "hasMechanisms", kind: "select", label: "Possui mecanismos", options: yesNo };
}

export function wealthField() {
  return { id: "filter-wealth", key: "hasWealth", kind: "select", label: "Possui patrimônio", options: yesNo };
}

export function journeyField() {
  return {
    id: "filter-journey",
    key: "journeyStage",
    kind: "select",
    label: "Estágio da jornada",
    options: [{ value: "all", label: "Todos" }, ...JOURNEY_STAGES.map((value) => ({ value, label: value }))],
  };
}

export function officialJourneyField() {
  return {
    id: "filter-journey",
    key: "journeyStage",
    kind: "select",
    label: "Estágio da jornada",
    options: [
      { value: "all", label: "Todos" },
      ...OFFICIAL_JOURNEY_STAGES.map((value) => ({ value, label: value })),
      { value: "Não informado", label: "Não informado" },
    ],
  };
}

export function advisorField() {
  return {
    id: "filter-advisor",
    key: "advisor",
    kind: "select",
    label: "Responsável / EP",
    options: [{ value: "all", label: "Todos" }, ...ADVISORS.map((value) => ({ value, label: value }))],
  };
}

export function PAGE_FILTERS() {
  return {
    visao_geral: [periodField()],
    clientes: [searchField(), periodField(), openFinanceField(), mechanismsField(), wealthField(), officialJourneyField()],
    patrimonio: [periodField(), advisorField(), wealthField()],
    open_finance: [periodField(), advisorField(), openFinanceField()],
    mecanismos: [periodField(), advisorField()],
    reunioes: [periodField(), advisorField()],
    formularios: [periodField(), advisorField()],
    jornada: [periodField(), journeyField(), advisorField()],
    pagamentos: [periodField(), advisorField()],
    qualidade: [periodField()],
  };
}

export { DATE_RANGE_PRESETS as PERIOD_PRESETS };
