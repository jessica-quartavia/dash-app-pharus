import { chartCard, chartGrid } from "./chart-card.mjs";
import { speedHBars, stackedShareBar } from "./charts.mjs";
import { kpiCard, kpiRow } from "./kpi-card.mjs";
import { sectionBlock } from "./page-kit.mjs";
import { formatKpiValue } from "../lib/kpi-value.mjs";

export function renderJourneySpeedKpis(kpis = []) {
  return kpiRow(
    kpis.map((kpi) =>
      kpiCard(kpi.label, formatKpiValue(kpi), kpi.note, {
        featured: Boolean(kpi.featured),
        tooltip: kpi.tooltip || kpi.description || kpi.note,
        insight: kpi.insight,
      }),
    ),
    "journey-speed-kpis",
  );
}

export function renderJourneySpeedSection(speed = {}, { id = "sec-journey-speed", title = "3. Velocidade da jornada" } = {}) {
  if (!speed || speed.status === "unavailable" || !Array.isArray(speed.kpis) || !speed.kpis.length) {
    return sectionBlock({
      id,
      title,
      lead: "Tempo típico (mediana) até as principais reuniões realizadas e acesso à plataforma.",
      body: `<p class="placeholder-note">Não foi possível carregar a velocidade da jornada. A fonte desta seção não chegou com a página.</p>`,
    });
  }
  return sectionBlock({
    id,
    title,
    lead: "Tempo típico (mediana) até as principais reuniões realizadas e acesso à plataforma. Complementa o funil: aqui entra quanto tempo levaram, não quantos chegaram. Busca e responsável recortam a mesma população oficial.",
    body: `${renderJourneySpeedKpis(speed.kpis)}${chartGrid(
      [
        chartCard({
          title: "Tempo típico até cada etapa",
          body: speedHBars(speed.chart || []),
        }),
        chartCard({
          title: "Acesso à plataforma",
          body: stackedShareBar(speed.access?.segments || []),
        }),
      ],
      "wide-narrow",
    )}`,
  });
}
