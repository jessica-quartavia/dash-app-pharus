export const OPEN_FINANCE_CONNECTIONS = [
  { clientId: "PH-1042", institution: "Itaú", status: "Ativa", health: "Saudável", accounts: 3, lastSyncAt: "2026-08-24T14:20:00-03:00", result: "Sucesso", accountTypes: ["Conta corrente", "Conta investimento"] },
  { clientId: "PH-1108", institution: "Nubank", status: "Ativa", health: "Saudável", accounts: 2, lastSyncAt: "2026-08-24T09:10:00-03:00", result: "Sucesso", accountTypes: ["Conta corrente", "Cartão de crédito"] },
  { clientId: "PH-1266", institution: "XP", status: "Ativa", health: "Saudável", accounts: 4, lastSyncAt: "2026-08-23T18:40:00-03:00", result: "Sucesso", accountTypes: ["Conta investimento", "Conta corrente"] },
  { clientId: "PH-1266", institution: "Itaú", status: "Ativa", health: "Atenção", accounts: 1, lastSyncAt: "2026-08-20T11:05:00-03:00", result: "Sucesso parcial", accountTypes: ["Conta corrente"] },
  { clientId: "PH-1301", institution: "Inter", status: "Ativa", health: "Saudável", accounts: 2, lastSyncAt: "2026-08-22T16:12:00-03:00", result: "Sucesso", accountTypes: ["Conta corrente", "Conta poupança"] },
  { clientId: "PH-1344", institution: "Bradesco", status: "Ativa", health: "Atenção", accounts: 2, lastSyncAt: "2026-08-18T08:30:00-03:00", result: "Sucesso parcial", accountTypes: ["Conta corrente"] },
  { clientId: "PH-1510", institution: "BTG", status: "Ativa", health: "Saudável", accounts: 3, lastSyncAt: "2026-08-24T12:00:00-03:00", result: "Sucesso", accountTypes: ["Conta investimento"] },
  { clientId: "PH-1558", institution: "Banco do Brasil", status: "Com problema", health: "Falha", accounts: 1, lastSyncAt: "2026-07-02T10:15:00-03:00", result: "Problema", accountTypes: ["Conta corrente"] },
  { clientId: "PH-1603", institution: "Nubank", status: "Ativa", health: "Saudável", accounts: 2, lastSyncAt: "2026-08-21T19:22:00-03:00", result: "Sucesso", accountTypes: ["Conta corrente", "Cartão de crédito"] },
  { clientId: "PH-1648", institution: "Itaú", status: "Ativa", health: "Saudável", accounts: 3, lastSyncAt: "2026-08-23T07:48:00-03:00", result: "Sucesso", accountTypes: ["Conta corrente", "Conta investimento"] },
  { clientId: "PH-1692", institution: "XP", status: "Ativa", health: "Atenção", accounts: 2, lastSyncAt: "2026-08-16T13:05:00-03:00", result: "Sucesso parcial", accountTypes: ["Conta investimento"] },
  { clientId: "PH-1824", institution: "Inter", status: "Ativa", health: "Saudável", accounts: 1, lastSyncAt: "2026-08-24T08:02:00-03:00", result: "Sucesso", accountTypes: ["Conta corrente"] },
  { clientId: "PH-1901", institution: "Nubank", status: "Ativa", health: "Saudável", accounts: 2, lastSyncAt: "2026-08-25T10:40:00-03:00", result: "Sucesso", accountTypes: ["Conta corrente"] },
  { clientId: "PH-1960", institution: "Bradesco", status: "Ativa", health: "Saudável", accounts: 2, lastSyncAt: "2026-08-19T15:33:00-03:00", result: "Sucesso", accountTypes: ["Conta corrente", "Conta poupança"] },
  { clientId: "PH-1988", institution: "BTG", status: "Ativa", health: "Saudável", accounts: 3, lastSyncAt: "2026-08-24T17:11:00-03:00", result: "Sucesso", accountTypes: ["Conta investimento", "Conta corrente"] },
];

export const OPEN_FINANCE_MONTHLY = [
  { month: "2025-09", connections: 6 },
  { month: "2025-10", connections: 7 },
  { month: "2025-11", connections: 7 },
  { month: "2025-12", connections: 8 },
  { month: "2026-01", connections: 9 },
  { month: "2026-02", connections: 9 },
  { month: "2026-03", connections: 10 },
  { month: "2026-04", connections: 11 },
  { month: "2026-05", connections: 12 },
  { month: "2026-06", connections: 13 },
  { month: "2026-07", connections: 14 },
  { month: "2026-08", connections: 15 },
];

export const OPEN_FINANCE_CASHFLOW = [
  { month: "2026-03", income: 186000, expense: 142000 },
  { month: "2026-04", income: 192000, expense: 151000 },
  { month: "2026-05", income: 201000, expense: 148000 },
  { month: "2026-06", income: 198000, expense: 156000 },
  { month: "2026-07", income: 210000, expense: 161000 },
  { month: "2026-08", income: 216000, expense: 154000 },
];

export const OPEN_FINANCE_EXPENSES = [
  { label: "Moradia", count: 42000, percent: 27 },
  { label: "Alimentação", count: 28000, percent: 18 },
  { label: "Transporte", count: 18000, percent: 12 },
  { label: "Saúde", count: 15000, percent: 10 },
  { label: "Educação", count: 12000, percent: 8 },
  { label: "Lazer", count: 16000, percent: 10 },
  { label: "Não informado", count: 23000, percent: 15 },
];

export const PROCESSED_TRANSACTIONS = 18420;
