/**
 * Classificação de nota CSAT.
 *
 * A regra de negócio recebida ("4 para baixo = melhoria; 4 para cima = positivo")
 * é ambígua para a nota 4. Este helper NÃO decide o lado da nota 4.
 *
 * Pontos positivos e de melhoria na página vêm da polaridade gravada no banco
 * (core.meeting_quality_dimension.polarity e metrics.feedback_survey_options.polarity),
 * não desta função.
 */
export function classifyCsatRating(score) {
  if (score == null || score === "") {
    return { score: null, bucket: null, classificationPending: false, reason: "missing_score" };
  }
  const value = Number(score);
  if (!Number.isFinite(value)) {
    return { score: null, bucket: null, classificationPending: false, reason: "missing_score" };
  }
  if (value === 4) {
    return {
      score: 4,
      bucket: null,
      classificationPending: true,
      reason: "rating_4_ambiguous",
    };
  }
  if (value >= 1 && value < 4) {
    return { score: value, bucket: "improvement", classificationPending: false, reason: "score_below_4" };
  }
  if (value > 4 && value <= 5) {
    return { score: value, bucket: "positive", classificationPending: false, reason: "score_above_4" };
  }
  return { score: value, bucket: null, classificationPending: false, reason: "out_of_scale" };
}

export function roundCsatAverage(values) {
  const list = (values || []).map(Number).filter((value) => Number.isFinite(value));
  if (!list.length) return null;
  return Math.round((list.reduce((sum, value) => sum + value, 0) / list.length) * 10) / 10;
}

export function ratingDistribution(scores) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const score of scores || []) {
    const value = Number(score);
    if (counts[value] != null) counts[value] += 1;
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return [1, 2, 3, 4, 5].map((stars) => ({
    stars,
    label: stars === 1 ? "1 estrela" : `${stars} estrelas`,
    count: counts[stars],
    percent: total ? Math.round((counts[stars] / total) * 1000) / 10 : 0,
  }));
}
