/**
 * Atividade operacional do cliente — eventos semanticamente claros.
 * Fontes: user_progress.completed_at, form_submissions.submitted_at,
 * scheduled_meetings.start_time, user_mechanisms.created_at (status suggested).
 */
import { timestampToIsoDate } from "../../js/lib/filters/period.mjs";

function touch(map, userId, ts) {
  if (!userId || !ts) return;
  const iso = timestampToIsoDate(ts) || String(ts).slice(0, 10);
  const key = String(userId);
  const prev = map.get(key);
  if (!prev || iso > prev) map.set(key, iso);
}

export function buildLastOperationalActivityMap({
  userProgress = [],
  formSubmissions = [],
  scheduledMeetings = [],
  userMechanisms = [],
  officialSet,
}) {
  const map = new Map();
  const allowed = officialSet || null;

  for (const row of userProgress) {
    if (allowed && !allowed.has(String(row.user_id))) continue;
    if (row.completed_at) touch(map, row.user_id, row.completed_at);
  }
  for (const row of formSubmissions) {
    if (allowed && !allowed.has(String(row.user_id))) continue;
    if (row.submitted_at) touch(map, row.user_id, row.submitted_at);
  }
  for (const row of scheduledMeetings) {
    if (allowed && !allowed.has(String(row.user_id))) continue;
    if (row.start_time) touch(map, row.user_id, row.start_time);
  }
  for (const row of userMechanisms) {
    if (allowed && !allowed.has(String(row.user_id))) continue;
    if (String(row.status) === "suggested" && row.created_at) touch(map, row.user_id, row.created_at);
  }
  return map;
}

export function stepCompleteIds(userProgress, step, officialSet) {
  const ids = new Set();
  for (const row of userProgress || []) {
    const id = String(row.user_id);
    if (officialSet && !officialSet.has(id)) continue;
    if (row.step === step && row.completed_at) ids.add(id);
  }
  return ids;
}

export function operationalInactivityCutoffIso(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff.toISOString().slice(0, 10);
}

export function countOperationalInactive(clients, cutoffIso) {
  return (clients || []).filter((client) => {
    if (!client.lastOperationalActivityAt) return true;
    return String(client.lastOperationalActivityAt).slice(0, 10) < cutoffIso;
  }).length;
}

export const OPERATIONAL_ACTIVITY_SOURCES =
  "progresso concluído (user_progress.completed_at), formulário enviado (form_submissions.submitted_at), reunião (scheduled_meetings.start_time), mecanismo implementado (user_mechanisms.created_at, status suggested).";
