export const DEFAULT_PAGE_ID = "visao_geral";

export const PAGE_GROUPS = [
  { id: "overview", label: "Visão" },
  { id: "carteira", label: "Carteira" },
  { id: "app", label: "App Pharus" },
  { id: "operacao", label: "Operação" },
];

export const PAGES = [
  {
    id: "visao_geral",
    hash: "visao-geral",
    aliases: ["home", "overview"],
    group: "overview",
    navLabel: "Visão Geral",
    title: "Visão Geral",
    eyebrow: "App Pharus",
    description: "Utilização e cobertura reais do App Pharus. Indicadores sem regra comprovada ficam pendentes.",
    implemented: true,
  },
  {
    id: "clientes",
    hash: "clientes",
    aliases: ["clients"],
    group: "carteira",
    navLabel: "Clientes",
    title: "Clientes",
    eyebrow: "Carteira",
    description: "Base oficial de clientes do App Pharus e uso dos recursos com dado comprovado.",
    implemented: true,
  },
  {
    id: "patrimonio",
    hash: "patrimonio",
    aliases: ["wealth"],
    group: "carteira",
    navLabel: "Patrimônio",
    title: "Patrimônio",
    eyebrow: "Carteira",
    description: "Informações financeiras cadastradas no App, com ativos, passivos e cobertura.",
    implemented: true,
  },
  {
    id: "open_finance",
    hash: "open-finance",
    aliases: ["openfinance", "of"],
    group: "app",
    navLabel: "Open Finance",
    title: "Open Finance",
    eyebrow: "App Pharus",
    description: "Conexões, contas, transações e saúde das integrações.",
    implemented: true,
  },
  {
    id: "mecanismos",
    hash: "mecanismos",
    aliases: ["mechanisms"],
    group: "app",
    navLabel: "Mecanismos",
    title: "Mecanismos",
    eyebrow: "App Pharus",
    description: "Disponibilidade e implementação dos mecanismos pelos clientes.",
    implemented: true,
  },
  {
    id: "reunioes",
    hash: "reunioes",
    aliases: ["meetings"],
    group: "app",
    navLabel: "Reuniões",
    title: "Reuniões",
    eyebrow: "Relacionamento",
    description: "Agenda, comparecimento, intervalos e avaliações das reuniões.",
    implemented: true,
  },
  {
    id: "formularios",
    hash: "formularios",
    aliases: ["forms"],
    group: "app",
    navLabel: "Formulários",
    title: "Formulários",
    eyebrow: "App Pharus",
    description: "Preenchimento do quiz comportamental e do questionário de alinhamento.",
    implemented: true,
  },
  {
    id: "jornada",
    hash: "jornada",
    aliases: ["progresso", "journey"],
    group: "app",
    navLabel: "Jornada",
    title: "Jornada",
    eyebrow: "App Pharus",
    description: "Estágio atual de cada cliente e pontos de abandono da jornada no App.",
    implemented: true,
  },
  {
    id: "pagamentos",
    hash: "pagamentos",
    aliases: ["payments"],
    group: "operacao",
    navLabel: "Pagamentos",
    title: "Pagamentos",
    eyebrow: "App Pharus",
    description: "Valores registrados no App. Não interpretar como receita oficial da empresa.",
    implemented: true,
  },
  {
    id: "qualidade",
    hash: "qualidade",
    aliases: ["quality"],
    group: "operacao",
    navLabel: "Qualidade dos Dados",
    title: "Qualidade dos Dados",
    eyebrow: "Sistema",
    description: "Cobertura por domínio: o que existe, o que falta e o status da qualidade.",
    implemented: true,
  },
];

const pagesById = new Map(PAGES.map((page) => [page.id, page]));
const pagesByHash = new Map();

for (const page of PAGES) {
  pagesByHash.set(page.hash.toLowerCase(), page);
  pagesByHash.set(page.id.toLowerCase(), page);
  for (const alias of page.aliases || []) {
    pagesByHash.set(String(alias).toLowerCase(), page);
  }
}

export function getPageById(id) {
  return pagesById.get(id) || null;
}

export function isPageImplemented(pageOrId) {
  const id = typeof pageOrId === "string" ? pageOrId : pageOrId?.id;
  return Boolean(getPageById(id)?.implemented);
}

export function resolvePageFromHash(rawHash) {
  const key = String(rawHash || "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
  if (!key) return getPageById(DEFAULT_PAGE_ID);
  return pagesByHash.get(key) || getPageById(DEFAULT_PAGE_ID);
}

export function getPagesByGroup(groupId) {
  return PAGES.filter((page) => page.group === groupId);
}

export function registerPage(page) {
  if (!page?.id || pagesById.has(page.id)) return;
  PAGES.push(page);
  pagesById.set(page.id, page);
  pagesByHash.set(page.hash.toLowerCase(), page);
  pagesByHash.set(page.id.toLowerCase(), page);
}
