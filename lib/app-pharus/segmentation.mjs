export const TIER_ORDER = ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Dados insuficientes"];

const TIER_1_INCOME = 100_000;
const TIER_1_CONTRIBUTION = 30_000;
const TIER_1_RESERVE = 500_000;
const TIER_2_MIN = 50_000;
const TIER_3_MIN = 20_000;

function parseMoney(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function classifyClientTier({ income, reserve, contribution } = {}) {
  const inc = parseMoney(income);
  const res = parseMoney(reserve);
  const con = parseMoney(contribution);
  const tier1Reasons = [];
  if (inc != null && inc >= TIER_1_INCOME) tier1Reasons.push("Renda mensal ≥ R$ 100 mil");
  if (con != null && con >= TIER_1_CONTRIBUTION) tier1Reasons.push("Aporte mensal ≥ R$ 30 mil");
  if (res != null && res >= TIER_1_RESERVE) tier1Reasons.push("Reserva ≥ R$ 500 mil");
  if (tier1Reasons.length) {
    return { tier: "Tier 1", tierReasons: tier1Reasons, income: inc, reserve: res, contribution: con };
  }
  if (inc != null && inc >= TIER_2_MIN && inc < TIER_1_INCOME) {
    return {
      tier: "Tier 2",
      tierReasons: ["Renda mensal entre R$ 50 mil e R$ 100 mil"],
      income: inc,
      reserve: res,
      contribution: con,
    };
  }
  if (inc != null && inc >= TIER_3_MIN && inc < TIER_2_MIN) {
    return {
      tier: "Tier 3",
      tierReasons: ["Renda mensal entre R$ 20 mil e R$ 50 mil"],
      income: inc,
      reserve: res,
      contribution: con,
    };
  }
  if (inc != null && inc < TIER_3_MIN) {
    return {
      tier: "Tier 4",
      tierReasons: ["Renda mensal abaixo de R$ 20 mil"],
      income: inc,
      reserve: res,
      contribution: con,
    };
  }
  return {
    tier: "Dados insuficientes",
    tierReasons: ["Sem renda suficiente para classificar Tier 2–4 e sem critério Tier 1"],
    income: inc,
    reserve: res,
    contribution: con,
  };
}

export function tierDistribution(clients = []) {
  const counts = new Map(TIER_ORDER.map((tier) => [tier, 0]));
  for (const client of clients) {
    const tier = client.tier || "Dados insuficientes";
    counts.set(tier, (counts.get(tier) || 0) + 1);
  }
  const total = clients.length || 0;
  return TIER_ORDER.map((label) => {
    const count = counts.get(label) || 0;
    return {
      label,
      count,
      percent: total ? Math.round((count / total) * 1000) / 10 : 0,
    };
  }).filter((item) => item.label !== "Dados insuficientes" || item.count > 0 || total === 0);
}
