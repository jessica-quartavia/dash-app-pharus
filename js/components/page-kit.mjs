import { escapeHtml } from "../utils/escape.mjs";

export function methodologyBanner(text, details = "") {
  const extra = details
    ? `<details class="sc-methodology-details"><summary>Ver nota metodológica</summary><p>${escapeHtml(details)}</p></details>`
    : "";
  return `<aside class="sc-methodology-banner"><p class="sc-methodology-note">${escapeHtml(text)}</p>${extra}</aside>`;
}

export function expoSourceBanner() {
  return `<aside class="expo-source-banner" role="note">
    <span class="expo-source-banner-icon" aria-hidden="true">i</span>
    <div class="expo-source-banner-copy">
      <strong>Fonte dos dados: Expo / EAS</strong>
      <p>Os indicadores desta página representam telemetria técnica e utilização do aplicativo registrada pelo Expo. Eles são independentes da base oficial de clientes do App Pharus no Supabase.</p>
    </div>
  </aside>`;
}

export function appUsageSourceBanner() {
  return `<aside class="expo-source-banner" role="note">
    <span class="expo-source-banner-icon" aria-hidden="true">i</span>
    <div class="expo-source-banner-copy">
      <strong>Fonte atual dos dados: Expo / EAS + App Pharus</strong>
      <p>Os dados técnicos de utilização, versões, builds e atualizações são obtidos pelo Expo/EAS. As informações da base Pharus aparecem separadamente como contexto agregado.</p>
    </div>
  </aside>`;
}

export function appUsageConstructionNotice() {
  return `<aside class="app-construction-notice" role="note">
    <strong>🔧 Em construção</strong>
    <p>Esta página ainda está em construção. Hoje ela utiliza dados do Expo/EAS e informações da base do App Pharus. Em breve também será conectada ao Firebase Analytics para ampliar as métricas de utilização e comportamento do aplicativo.</p>
    <small>Firebase Analytics será incorporado futuramente e ainda não faz parte dos cálculos atuais.</small>
  </aside>`;
}

export function sectionBlock({ id, title, lead, body }) {
  return `<section class="section-block" id="${escapeHtml(id)}">
    <h2>${escapeHtml(title)}</h2>
    ${lead ? `<p class="note-muted">${escapeHtml(lead)}</p>` : ""}
    ${body}
  </section>`;
}
