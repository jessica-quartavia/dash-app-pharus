import { kpiCard, kpiRow } from "../components/kpi-card.mjs";
import { dataTable, tablePanel } from "../components/data-table.mjs";
import { methodologyBanner, sectionBlock } from "../components/page-kit.mjs";
import { yesNoBadge } from "../components/status-badge.mjs";
import { openClientDrawer } from "../components/client-drawer.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";
import { mountPage } from "../lib/page-runtime.mjs";
import { getClientById, getClientsPage } from "../services/app-pharus/clients.mjs";
import { formatDate } from "../utils/format.mjs";
import { escapeHtml } from "../utils/escape.mjs";

function renderKpis(kpis) {
  const primary = kpis.filter((kpi) => kpi.key === "total" || kpi.key === "active" || kpi.key === "new" || kpi.key === "complete");
  const secondary = kpis.filter((kpi) => kpi.key === "inactive");
  return (
    kpiRow(
      primary.map((kpi) =>
        kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, {
          featured: true,
          tooltip: kpi.note,
        }),
      ),
      "kpi-row-primary",
    ) +
    (secondary.length
      ? kpiRow(
          secondary.map((kpi) =>
            kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, {
              compact: true,
              tooltip: kpi.note,
            }),
          ),
          "kpi-row-secondary",
        )
      : "")
  );
}

export function bootClientes() {
  mountPage({
    pageId: "clientes",
    filterNote:
      "Busca, Open Finance, possui mecanismos, patrimônio e estágio filtram a base oficial. O período usa a data de cadastro, depois de Aplicar.",
    load: getClientsPage,
    render: (data) => {
      queueMicrotask(() => {
        document.querySelectorAll("#page-content [data-row-id]").forEach((row) => {
          row.addEventListener("click", async () => {
            const client = await getClientById(row.dataset.rowId);
            openClientDrawer(client);
          });
        });
      });
      return `
        ${methodologyBanner(data.methodology || "Base oficial do App Pharus. Sem regra definida, o indicador fica pendente.")}
        ${sectionBlock({
          id: "sec-client-kpis",
          title: "1. Resumo da base",
          lead: "Total oficial e cadastros no período. Ativo, cadastro completo e atividade recente ficam pendentes até haver regra de negócio.",
          body: renderKpis(data.kpis),
        })}
        ${sectionBlock({
          id: "sec-client-table",
          title: "2. Clientes",
          lead: "A listagem parte dos clientes oficiais. A ausência de patrimônio, Open Finance ou reunião não remove o cliente da base.",
          body: tablePanel({
            title: `${data.recorteTotal} no recorte · ${data.officialTotal} na população oficial`,
            table: dataTable({
              clickable: true,
              columns: [
                { label: "Cliente", value: (row) => `<strong>${escapeHtml(row.name)}</strong><div class="text-muted">${escapeHtml(row.email || row.id)}</div>` },
                { label: "Data de cadastro", value: (row) => formatDate(row.registeredAt) },
                { label: "Patrimônio", value: (row) => yesNoBadge(row.hasWealth) },
                { label: "Open Finance", value: (row) => yesNoBadge(row.hasOpenFinance) },
                { label: "Mecanismos", value: (row) => yesNoBadge(row.hasMechanisms) },
                { label: "Reuniões", value: (row) => yesNoBadge(row.hasMeetings) },
                { label: "Estágio da jornada", value: (row) => escapeHtml(row.journeyStage || "Não informado") },
              ],
              rows: data.rows,
            }),
          }),
        })}
      `;
    },
  });
}
