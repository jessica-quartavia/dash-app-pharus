/** Dataset somente leitura para a página CSAT. */
import { dataRestFetchAll } from "../data/pharus-rest.mjs";
import { buildClientsDataset } from "./clients-page.mjs";
import { classifyCsatRating } from "./csat-rating.mjs";

const CACHE_MS = 5 * 60 * 1000;
let cache = { at: 0, data: null, pending: null };

function clientIndex(dataset) {
  return new Map((dataset.clients || []).map((client) => [String(client.id), client]));
}

function scoreFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  if (snapshot.value_type === "number" && Number.isFinite(Number(snapshot.value))) return Number(snapshot.value);
  return null;
}

function polarityOf(value) {
  if (value === "positive" || value === "improvement") return value;
  return null;
}

export async function buildCsatDataset({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.data && now - cache.at < CACHE_MS) return cache.data;
  if (!force && cache.pending) return cache.pending;

  const pending = (async () => {
    const clientsDataset = await buildClientsDataset({ force });
    const index = clientIndex(clientsDataset);
    const advisorById = new Map((clientsDataset.advisors || []).map((item) => [String(item.id), item]));

    const [
      evaluations,
      dimensions,
      scheduled,
      meetings,
      surveys,
      responses,
      responseOptions,
      surveyOptions,
    ] = await Promise.all([
      dataRestFetchAll("scheduled_meeting_evaluation", "id,scheduled_meeting_id,user_id,stars,selected_quality_slugs,other_text,created_at", { schema: "core" }),
      dataRestFetchAll("meeting_quality_dimension", "slug,label,polarity,status,allows_free_text", { schema: "core" }),
      dataRestFetchAll("scheduled_meetings", "id,user_id,meeting_id,advisor_internal_id,start_time,status", { schema: "core" }),
      dataRestFetchAll("meetings", "id,meeting_title,meeting_slug,is_active", { schema: "core" }),
      dataRestFetchAll("feedback_surveys", "id,key,metric_type,title,channel,product,status,metadata", { schema: "metrics" }),
      dataRestFetchAll("feedback_responses", "id,survey_id,score_id,score_snapshot,comment_text,user_id,advisor_internal_id,advisor_snapshot,metadata,created_at", { schema: "metrics" }),
      dataRestFetchAll("feedback_response_options", "id,response_id,option_id,label_snapshot,free_text,created_at", { schema: "metrics" }),
      dataRestFetchAll("feedback_survey_options", "id,survey_id,label,polarity,allows_free_text,status", { schema: "metrics" }),
    ]);

    const dimensionIndex = new Map(dimensions.map((row) => [String(row.slug), row]));
    const scheduledIndex = new Map(scheduled.map((row) => [String(row.id), row]));
    const meetingIndex = new Map(meetings.map((row) => [String(row.id), row]));
    const surveyIndex = new Map(surveys.map((row) => [String(row.id), row]));
    const optionIndex = new Map(surveyOptions.map((row) => [String(row.id), row]));

    const optionsByResponse = new Map();
    for (const row of responseOptions) {
      const key = String(row.response_id);
      if (!optionsByResponse.has(key)) optionsByResponse.set(key, []);
      optionsByResponse.get(key).push(row);
    }

    const meetingRows = evaluations.map((row) => {
      const scheduledMeeting = scheduledIndex.get(String(row.scheduled_meeting_id));
      const catalog = meetingIndex.get(String(scheduledMeeting?.meeting_id || ""));
      const client = index.get(String(row.user_id));
      const advisorId = scheduledMeeting?.advisor_internal_id || client?.advisorId || null;
      const qualities = (row.selected_quality_slugs || [])
        .map((slug) => dimensionIndex.get(String(slug)))
        .filter(Boolean);
      const score = row.stars == null ? null : Number(row.stars);
      return {
        id: row.id,
        origin: "meetings",
        originLabel: "Reuniões",
        score,
        createdAt: row.created_at,
        clientId: row.user_id,
        clientName: client?.name || client?.email || (row.user_id ? "Cliente sem nome" : "Sem usuário"),
        clientEmail: client?.email || null,
        officialClient: Boolean(client),
        advisorId: advisorId ? String(advisorId) : null,
        advisor: advisorById.get(String(advisorId))?.name || client?.advisor || null,
        subject: catalog?.meeting_title || catalog?.meeting_slug || "Reunião",
        screenKey: null,
        meetingId: row.scheduled_meeting_id,
        meetingType: catalog?.meeting_title || catalog?.meeting_slug || "Não informado",
        comment: row.other_text || null,
        positivePoints: qualities.filter((item) => polarityOf(item.polarity) === "positive").map((item) => item.label),
        improvementPoints: qualities.filter((item) => polarityOf(item.polarity) === "improvement").map((item) => item.label),
        classification: classifyCsatRating(score),
      };
    });

    const csatSurveys = surveys.filter((row) => String(row.metric_type) === "csat");
    const csatSurveyIds = new Set(csatSurveys.map((row) => String(row.id)));

    const platformRows = responses
      .filter((row) => csatSurveyIds.has(String(row.survey_id)))
      .map((row) => {
        const survey = surveyIndex.get(String(row.survey_id));
        const client = index.get(String(row.user_id));
        const advisorId = row.advisor_internal_id || client?.advisorId || null;
        const snapshotName = row.advisor_snapshot && typeof row.advisor_snapshot === "object"
          ? row.advisor_snapshot.name || row.advisor_snapshot.full_name || null
          : null;
        const selected = optionsByResponse.get(String(row.id)) || [];
        const labeled = selected.map((item) => {
          const catalog = optionIndex.get(String(item.option_id));
          return {
            label: item.label_snapshot || catalog?.label || "Opção",
            polarity: polarityOf(catalog?.polarity),
            freeText: item.free_text || null,
          };
        });
        const score = scoreFromSnapshot(row.score_snapshot);
        return {
          id: row.id,
          origin: "platform",
          originLabel: "Plataforma",
          score,
          createdAt: row.created_at,
          clientId: row.user_id,
          clientName: client?.name || client?.email || (row.user_id ? "Cliente sem nome" : "Sem usuário"),
          clientEmail: client?.email || null,
          officialClient: Boolean(client),
          advisorId: advisorId ? String(advisorId) : null,
          advisor: advisorById.get(String(advisorId))?.name || snapshotName || client?.advisor || null,
          subject: survey?.title || survey?.key || "Tela",
          screenKey: survey?.key || null,
          screenTitle: survey?.title || survey?.key || "Tela",
          journeyStep: row.metadata?.journeyStep || null,
          meetingId: null,
          meetingType: null,
          comment: row.comment_text || null,
          positivePoints: labeled.filter((item) => item.polarity === "positive").map((item) => item.label),
          improvementPoints: labeled.filter((item) => item.polarity === "improvement").map((item) => item.label),
          classification: classifyCsatRating(score),
        };
      });

    const completedMeetings = scheduled.filter((row) => String(row.status) === "completed").map((row) => ({
      id: row.id,
      userId: row.user_id,
      date: row.start_time,
      status: row.status,
    }));

    const meetingCounts = new Map();
    for (const row of meetingRows) {
      const key = String(row.meetingId);
      meetingCounts.set(key, (meetingCounts.get(key) || 0) + 1);
    }
    const platformDup = new Map();
    for (const row of platformRows) {
      const key = `${row.clientId}|${row.screenKey}`;
      platformDup.set(key, (platformDup.get(key) || 0) + 1);
    }

    const data = {
      clients: clientsDataset.clients,
      advisors: clientsDataset.advisors,
      meetingRows,
      platformRows,
      rows: [...meetingRows, ...platformRows],
      completedMeetings,
      screens: csatSurveys.map((row) => ({ key: row.key, title: row.title })).sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
      quality: {
        meetingsWithoutScore: meetingRows.filter((row) => row.score == null).length,
        meetingsWithoutUser: meetingRows.filter((row) => !row.clientId).length,
        meetingsWithoutComment: meetingRows.filter((row) => !row.comment).length,
        meetingsWithoutMeeting: meetingRows.filter((row) => !row.meetingId).length,
        platformWithoutScore: platformRows.filter((row) => row.score == null).length,
        platformWithoutUser: platformRows.filter((row) => !row.clientId).length,
        platformWithoutComment: platformRows.filter((row) => !row.comment).length,
        platformWithoutScreen: platformRows.filter((row) => !row.screenKey).length,
        duplicateMeetingEvaluations: [...meetingCounts.values()].filter((count) => count > 1).length,
        duplicatePlatformPairs: [...platformDup.values()].filter((count) => count > 1).length,
      },
      source: {
        schemas: ["auth", "core", "metrics"],
        tables: [
          "core.scheduled_meeting_evaluation",
          "core.meeting_quality_dimension",
          "core.scheduled_meetings",
          "core.meetings",
          "metrics.feedback_surveys",
          "metrics.feedback_responses",
          "metrics.feedback_response_options",
          "metrics.feedback_survey_options",
        ],
        missingTable: "metrics.feedback",
        note: "Não existe a tabela metrics.feedback. A plataforma usa metrics.feedback_surveys + feedback_responses.",
      },
    };
    cache = { at: Date.now(), data, pending: null };
    return data;
  })().catch((error) => {
    cache = { at: 0, data: null, pending: null };
    throw error;
  });

  cache = { ...cache, pending };
  return pending;
}
