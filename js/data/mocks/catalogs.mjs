export const ADVISORS = ["Mariana Costa", "Rafael Mendes", "Camila Rocha", "Pedro Nogueira"];

export const CLIENT_STATUSES = ["Ativo", "Inativo", "Sem atividade recente"];

export const JOURNEY_STAGES = [
  "Cadastro",
  "Cadastro financeiro",
  "Open Finance",
  "Formulários",
  "Mecanismos",
  "Reuniões",
  "Acompanhamento",
  "Concluída",
];

export const MECHANISM_CATALOG = [
  { id: "reserva", name: "Reserva de emergência", category: "Liquidez" },
  { id: "protecao", name: "Proteção patrimonial", category: "Proteção" },
  { id: "sucessao", name: "Planejamento sucessório", category: "Estrutura" },
  { id: "diversificacao", name: "Diversificação", category: "Investimentos" },
  { id: "familiar", name: "Proteção familiar", category: "Proteção" },
  { id: "liquidez", name: "Gestão de liquidez", category: "Liquidez" },
  { id: "dividas", name: "Endividamento consciente", category: "Passivos" },
  { id: "previdencia", name: "Previdência", category: "Investimentos" },
];

export const FORM_CATALOG = [
  { id: "quiz", name: "Quiz comportamental" },
  { id: "alinhamento", name: "Questionário de alinhamento" },
];

export const INSTITUTIONS = ["Itaú", "Nubank", "Bradesco", "Banco do Brasil", "Inter", "XP", "BTG"];

export const ACCOUNT_TYPES = ["Conta corrente", "Conta poupança", "Conta investimento", "Cartão de crédito"];

export const EXPENSE_CATEGORIES = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Não informado",
];

export const MEETING_TYPES = ["Kickoff", "Acompanhamento", "Revisão patrimonial", "Alinhamento"];

export const WEALTH_CLASSES = [
  { key: "equities", label: "Renda variável" },
  { key: "fixedIncome", label: "Renda fixa" },
  { key: "funds", label: "Fundos" },
  { key: "pensions", label: "Previdência" },
  { key: "otherInvestments", label: "Outros investimentos" },
  { key: "realEstate", label: "Imóveis" },
  { key: "movable", label: "Bens móveis" },
  { key: "consortia", label: "Consórcios" },
  { key: "financings", label: "Financiamentos", liability: true },
  { key: "loans", label: "Empréstimos", liability: true },
];
