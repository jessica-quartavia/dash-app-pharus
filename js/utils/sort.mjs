const UNKNOWN_LABELS = new Set(["não informado", "nao informado", "não classificado", "outros"]);

export function isUnknownLabel(label) {
  return UNKNOWN_LABELS.has(String(label || "").trim().toLowerCase());
}

export function sortUnknownLast(items, getLabel = (item) => item.label) {
  return [...(items || [])].sort((a, b) => {
    const aUnknown = isUnknownLabel(getLabel(a));
    const bUnknown = isUnknownLabel(getLabel(b));
    if (aUnknown === bUnknown) return 0;
    return aUnknown ? 1 : -1;
  });
}

export function sortDistributionUnknownLast(items) {
  const known = [];
  const unknown = [];
  for (const item of items || []) {
    if (isUnknownLabel(item.label)) unknown.push(item);
    else known.push(item);
  }
  known.sort((a, b) => (b.count || 0) - (a.count || 0));
  return [...known, ...unknown];
}
