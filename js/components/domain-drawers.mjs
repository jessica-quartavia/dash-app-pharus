import { drawerShell, openEntityDrawer } from "./entity-drawer.mjs";
import { escapeHtml } from "../utils/escape.mjs";
import { formatCurrencyExact, formatDate, formatDateTime, formatNumber } from "../utils/format.mjs";
import { statusBadge, tierBadge, yesNoBadge } from "./status-badge.mjs";

function dl(items) {
  return `<dl>${items
    .filter((item) => item != null)
    .map(
      (item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${item.value ?? "Não informado"}</dd></div>`,
    )
    .join("")}</dl>`;
}

function mechanismCell(client) {
  if (client.hasMechanisms == null) return yesNoBadge(null);
  if (!client.hasMechanisms) return yesNoBadge(false);
  const n = client.mechanismsImplemented;
  if (n == null || n <= 0) return yesNoBadge(true);
  return `${yesNoBadge(true)} <span class="note-muted">${formatNumber(n)} implementado${n === 1 ? "" : "s"}</span>`;
}

export function openClientDrawer(client) {
  if (!client) return;
  const tierReasons = (client.tierReasons || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const body = `
    <p class="note-muted">Visão resumida do cliente na população oficial. Campos indisponíveis não são inferidos.</p>
    ${dl([
      { label: "E-mail", value: escapeHtml(client.email || client.id) },
      { label: "Data de cadastro", value: formatDate(client.registeredAt) },
      { label: "Segmentação", value: tierBadge(client.tier, client.isDebts) },
      {
        label: "Renda mensal",
        value: client.tierIncome != null ? formatCurrencyExact(client.tierIncome) : "Não informado",
      },
      {
        label: "Aporte mensal",
        value: client.tierContribution != null ? formatCurrencyExact(client.tierContribution) : "Não informado",
      },
      {
        label: "Reserva",
        value: client.tierReserve != null ? formatCurrencyExact(client.tierReserve) : "Não informado",
      },
      client.advisor ? { label: "Responsável / EP", value: escapeHtml(client.advisor) } : null,
      { label: "Onboarding concluído", value: yesNoBadge(client.onboardingComplete) },
      { label: "Dados pessoais concluídos", value: yesNoBadge(client.personalDataComplete) },
      { label: "Última atividade operacional", value: client.lastOperationalActivityAt ? formatDate(client.lastOperationalActivityAt) : "Nenhuma registrada" },
      { label: "Patrimônio", value: yesNoBadge(client.hasWealth) },
      { label: "Open Finance", value: yesNoBadge(client.hasOpenFinance) },
      { label: "Mecanismos", value: mechanismCell(client) },
      { label: "Reuniões", value: yesNoBadge(client.hasMeetings) },
      { label: "Formulários", value: yesNoBadge(client.hasForms) },
      { label: "Jornada", value: escapeHtml(client.journeyStage || "Não informado") },
    ])}
    ${tierReasons ? `<div class="drawer-subsection"><h4>Critérios do Tier</h4><ul class="simple-list">${tierReasons}</ul></div>` : ""}
  `;
  openEntityDrawer(
    drawerShell({
      eyebrow: "Visão 360 do cliente",
      title: escapeHtml(client.name),
      subtitle: escapeHtml(client.email || client.id),
      body,
    }),
  );
}

export function openWealthDrawer(row) {
  const wealth = row.wealth;
  const body = wealth
    ? dl([
        { label: "Patrimônio total", value: formatCurrencyExact(wealth.total) },
        { label: "Investimentos", value: formatCurrencyExact(wealth.investments) },
        { label: "Imóveis", value: formatCurrencyExact(wealth.realEstate) },
        { label: "Financeiro", value: formatCurrencyExact(wealth.financial) },
        { label: "Outros ativos", value: formatCurrencyExact(wealth.otherAssets) },
        { label: "Previdência", value: formatCurrencyExact(wealth.pension) },
        { label: "Consórcios", value: formatCurrencyExact(wealth.consortium) },
        { label: "Financiamentos", value: formatCurrencyExact(wealth.financings) },
        { label: "Empréstimos", value: formatCurrencyExact(wealth.loans) },
        { label: "Passivos (total)", value: formatCurrencyExact(wealth.liabilities) },
        { label: "Patrimônio líquido", value: formatCurrencyExact(wealth.net) },
      ])
    : `<p class="placeholder-note">Cliente sem patrimônio cadastrado no recorte.</p>`;
  openEntityDrawer(
    drawerShell({
      eyebrow: "Patrimônio do cliente",
      title: escapeHtml(row.name),
      body,
    }),
  );
}

export function openOpenFinanceDrawer(row) {
  openEntityDrawer(
    drawerShell({
      eyebrow: "Conexão Open Finance",
      title: escapeHtml(row.clientName || row.clientId),
      subtitle: escapeHtml(row.institution),
      body: dl([
        { label: "Instituição", value: escapeHtml(row.institution) },
        { label: "Status", value: statusBadge(row.status) },
        { label: "Saúde", value: statusBadge(row.health) },
        { label: "Resultado", value: escapeHtml(row.result) },
        { label: "Contas", value: formatNumber(row.accounts) },
        { label: "Tipos de conta", value: escapeHtml((row.accountTypes || []).join(", ") || "Não informado") },
        { label: "Última sincronização", value: formatDateTime(row.lastSyncAt) },
      ]),
    }),
  );
}

export function openMeetingDrawer(row) {
  openEntityDrawer(
    drawerShell({
      eyebrow: "Reunião",
      title: escapeHtml(row.clientName || row.clientId),
      subtitle: escapeHtml(row.type),
      body: dl([
        { label: "Tipo", value: escapeHtml(row.type) },
        { label: "Responsável", value: escapeHtml(row.advisor) },
        { label: "Data", value: formatDate(row.date) },
        { label: "Status", value: statusBadge(row.status) },
        { label: "Avaliação", value: row.score == null ? "Não informado" : `${row.score} de 5` },
        { label: "Outputs", value: formatNumber(row.outputs) },
      ]),
    }),
  );
}

export function openFormDrawer(row) {
  openEntityDrawer(
    drawerShell({
      eyebrow: "Formulário",
      title: escapeHtml(row.clientName || row.clientId),
      subtitle: escapeHtml(row.formName || row.formId),
      body: dl([
        { label: "Formulário", value: escapeHtml(row.formName || row.formId) },
        { label: "Status", value: statusBadge(row.status) },
        { label: "Início", value: formatDate(row.startedAt) },
        { label: "Conclusão", value: formatDate(row.completedAt) },
        { label: "Perfil", value: escapeHtml(row.profile || "Não informado") },
      ]),
    }),
  );
}

export function openJourneyDrawer(row) {
  openEntityDrawer(
    drawerShell({
      eyebrow: "Jornada do cliente",
      title: escapeHtml(row.name),
      subtitle: escapeHtml(row.journeyStage || "Não informado"),
      body: dl([
        { label: "Estágio atual", value: escapeHtml(row.journeyStage || "Não informado") },
        { label: "Jornada iniciada", value: yesNoBadge(row.hasJourney) },
        { label: "Início da jornada", value: formatDate(row.journeyStartedAt) },
        { label: "Conclusão", value: formatDate(row.journeyCompletedAt) },
      ]),
    }),
  );
}

export function openPaymentDrawer(row) {
  openEntityDrawer(
    drawerShell({
      eyebrow: "Pagamento",
      title: escapeHtml(row.clientName || row.clientId),
      body: dl([
        { label: "Data", value: formatDate(row.date) },
        { label: "Valor", value: formatCurrencyExact(row.amount) },
        { label: "Forma", value: escapeHtml(row.method || "Não informado") },
        { label: "Status", value: statusBadge(row.status) },
        { label: "Referência", value: escapeHtml(row.reference || "Não informado") },
      ]),
    }),
  );
}

export function openQualityDrawer(row) {
  openEntityDrawer(
    drawerShell({
      eyebrow: "Qualidade dos dados",
      title: escapeHtml(row.domain),
      body: dl([
        { label: "Fonte", value: escapeHtml(row.source) },
        { label: "Cobertura", value: `${row.percent ?? 0}%` },
        { label: "Com dado", value: formatNumber(row.withData) },
        { label: "Sem dado", value: formatNumber(row.withoutData) },
        { label: "Status", value: statusBadge(row.tone) },
      ]),
    }),
  );
}

export function openMechanismDrawer(client) {
  const count = Number(client.mechanismsImplemented) || 0;
  const mechanisms = client.mechanisms || [];
  const list =
    mechanisms.length > 0
      ? `<ul class="mechanism-drawer-list">${mechanisms
          .map(
            (item) => `<li class="mechanism-drawer-item">
              <div class="mechanism-drawer-item-head">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="note-muted">${escapeHtml(item.category || "Não informado")}</span>
              </div>
              ${item.implementedAt ? `<p class="mechanism-drawer-date">Implementado em ${formatDate(item.implementedAt)}</p>` : ""}
              ${item.description ? `<p class="mechanism-drawer-desc">${escapeHtml(item.description)}</p>` : ""}
            </li>`,
          )
          .join("")}</ul>`
      : `<p class="placeholder-note">Nenhum mecanismo implementado</p>`;

  openEntityDrawer(
    drawerShell({
      eyebrow: "Mecanismos do cliente",
      title: escapeHtml(client.name),
      subtitle: `${escapeHtml(client.email || client.id)} · ${formatNumber(count)} implementado${count === 1 ? "" : "s"}`,
      body: `<section class="mechanism-drawer-section"><h3>Mecanismos implementados</h3>${list}</section>`,
      className: "drawer-mechanisms",
    }),
  );
}

export { closeEntityDrawer as closeClientDrawer } from "./entity-drawer.mjs";
