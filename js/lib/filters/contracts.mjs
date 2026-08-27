import { DATE_RANGE_PRESETS } from "./period.mjs";
import { OFFICIAL_JOURNEY_STAGES } from "../../../lib/app-pharus/clients.mjs";

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
    options: [{ value: "all", label: "Todos" }],
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
    options: [{ value: "all", label: "Todos" }],
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

export function segmentField() {
  return {
    id: "filter-segment",
    key: "segment",
    kind: "select",
    label: "Segmento",
    options: [
      { value: "all", label: "Todos" },
      { value: "Tier 1", label: "Tier 1" },
      { value: "Tier 2", label: "Tier 2" },
      { value: "Tier 3", label: "Tier 3" },
      { value: "Tier 4", label: "Tier 4" },
      { value: "Dados insuficientes", label: "Dados insuficientes" },
    ],
  };
}

export function debtsField() {
  return { id: "filter-debts", key: "debts", kind: "select", label: "DEBTS", options: yesNo };
}

export function advisorField(advisors = []) {
  return {
    id: "filter-advisor",
    key: "advisor",
    kind: "select",
    label: "Responsável / EP",
    options: [
      { value: "all", label: "Todos" },
      ...(advisors || []).map((item) => ({
        value: item.id,
        label: item.count != null ? `${item.name} (${item.count})` : item.name,
      })),
    ],
  };
}

export function PAGE_FILTERS() {
  return {
    visao_geral: [periodField()],
    clientes: [
      searchField(),
      periodField(),
      openFinanceField(),
      mechanismsField(),
      wealthField(),
      officialJourneyField(),
      segmentField(),
    ],
    patrimonio: [periodField(), advisorField(), wealthField()],
    open_finance: [periodField(), advisorField(), openFinanceField()],
    mecanismos: [searchField(), periodField(), advisorField()],
    reunioes: [periodField(), advisorField()],
    formularios: [periodField(), advisorField()],
    jornada: [],
    pagamentos: [periodField(), advisorField()],
    qualidade: [periodField()],
    utilizacao_app: [periodField()],
  };
}

export { DATE_RANGE_PRESETS as PERIOD_PRESETS };
