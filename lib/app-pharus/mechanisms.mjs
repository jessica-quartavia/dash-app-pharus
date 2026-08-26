/**
 * Mecanismos no Dash App Pharus.
 *
 * Regra de negócio definitiva: status = suggested significa implementado.
 * "Com mecanismo" e "mecanismo implementado" são o mesmo conceito.
 * A interface não deve expor o valor interno "suggested".
 */
export const IMPLEMENTED_MECHANISM_STATUS = "suggested";

export const MECHANISM_QTY_BUCKETS = ["0", "1 a 2", "3 a 4", "5 ou mais"];

export function isImplementedMechanism(row) {
  return String(row?.status || "").trim().toLowerCase() === IMPLEMENTED_MECHANISM_STATUS;
}

export function implementedMechanismRows(rows) {
  return (rows || []).filter(isImplementedMechanism);
}

export function mechanismPairKey(userId, mechanismId) {
  return `${userId}::${mechanismId}`;
}

function mechanismData(row) {
  const raw = row?.data;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function catalogFromRow(row) {
  const data = mechanismData(row);
  const id = String(row?.id || "").trim();
  const description = String(data.description || data.strategy || "").trim();
  return {
    id,
    name: String(data.name || id || "Mecanismo").trim() || id || "Mecanismo",
    category: String(data.category || "").trim() || "Não informado",
    description: description || null,
  };
}

/** Lista de mecanismos por cliente, ordenada do mais recente ao mais antigo. */
export function clientMechanismsLists(records, catalog) {
  const catalogMap = new Map((catalog || []).map((item) => [item.id, item]));
  const byClient = new Map();
  for (const rec of records || []) {
    const userId = String(rec.user_id);
    const mechanismId = String(rec.mechanism_id);
    const meta = catalogMap.get(mechanismId) || {
      id: mechanismId,
      name: mechanismId,
      category: "Não informado",
      description: null,
    };
    if (!byClient.has(userId)) byClient.set(userId, []);
    byClient.get(userId).push({
      mechanism_id: mechanismId,
      name: meta.name,
      category: meta.category,
      description: meta.description,
      implementedAt: rec.created_at || null,
    });
  }
  for (const list of byClient.values()) {
    list.sort((a, b) => {
      if (a.implementedAt && b.implementedAt) {
        return String(b.implementedAt).localeCompare(String(a.implementedAt));
      }
      if (a.implementedAt) return -1;
      if (b.implementedAt) return 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }
  return byClient;
}

export function uniqueImplementedRecords(rows, officialSet) {
  const map = new Map();
  for (const row of implementedMechanismRows(rows)) {
    if (row?.user_id == null) continue;
    const userId = String(row.user_id);
    if (officialSet && !officialSet.has(userId)) continue;
    const mechanismId = row.mechanism_id != null ? String(row.mechanism_id).trim() : "";
    if (!mechanismId) continue;
    const key = mechanismPairKey(userId, mechanismId);
    const createdAt = row.created_at || null;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { user_id: userId, mechanism_id: mechanismId, created_at: createdAt });
      continue;
    }
    if (createdAt && (!prev.created_at || String(createdAt) > String(prev.created_at))) {
      prev.created_at = createdAt;
    }
  }
  return [...map.values()];
}

export function officialImplementedUserIds(rows, officialSet) {
  const set = new Set();
  for (const rec of uniqueImplementedRecords(rows, officialSet)) set.add(rec.user_id);
  return set;
}

/** DISTINCT user_id + mechanism_id para não contar o mesmo mecanismo duas vezes no mesmo cliente. */
export function officialImplementedPairs(rows, officialSet) {
  const set = new Set();
  for (const rec of uniqueImplementedRecords(rows, officialSet)) {
    set.add(mechanismPairKey(rec.user_id, rec.mechanism_id));
  }
  return set;
}

export function countsPerOfficialClient(records, officialIds) {
  const counts = new Map();
  for (const id of officialIds || []) counts.set(String(id), 0);
  for (const rec of records || []) {
    const userId = String(rec.user_id);
    if (!counts.has(userId)) continue;
    counts.set(userId, counts.get(userId) + 1);
  }
  return counts;
}

export function qtyBucket(n) {
  const count = Number(n) || 0;
  if (count <= 0) return "0";
  if (count <= 2) return "1 a 2";
  if (count <= 4) return "3 a 4";
  return "5 ou mais";
}

export function qtyDistribution(counts, totalClients) {
  const bucketCounts = Object.fromEntries(MECHANISM_QTY_BUCKETS.map((label) => [label, 0]));
  for (const n of counts.values()) bucketCounts[qtyBucket(n)] += 1;
  const total = totalClients || counts.size || 0;
  return MECHANISM_QTY_BUCKETS.map((label) => ({
    label,
    count: bucketCounts[label],
    percent: total ? (bucketCounts[label] / total) * 100 : 0,
  }));
}

export function byMechanism(records, catalog, clientTotal) {
  const usersByMech = new Map();
  for (const rec of records || []) {
    if (!usersByMech.has(rec.mechanism_id)) usersByMech.set(rec.mechanism_id, new Set());
    usersByMech.get(rec.mechanism_id).add(rec.user_id);
  }
  return (catalog || [])
    .map((item) => {
      const count = usersByMech.get(item.id)?.size || 0;
      return {
        id: item.id,
        label: item.name,
        category: item.category,
        count,
        percent: clientTotal ? (count / clientTotal) * 100 : 0,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

export function byCategory(records, catalog) {
  const categoryById = new Map((catalog || []).map((item) => [item.id, item.category]));
  const counts = new Map();
  for (const rec of records || []) {
    const label = categoryById.get(rec.mechanism_id) || "Não informado";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const total = (records || []).length || 0;
  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percent: total ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

export function monthlyImplementations(records) {
  const counts = new Map();
  for (const rec of records || []) {
    if (!rec.created_at) continue;
    const month = String(rec.created_at).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    counts.set(month, (counts.get(month) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));
}

export function lastImplementedAt(records) {
  let max = null;
  for (const rec of records || []) {
    if (!rec.created_at) continue;
    if (!max || String(rec.created_at) > String(max)) max = rec.created_at;
  }
  return max;
}

export function clientMechanismDates(records) {
  const map = new Map();
  for (const rec of records || []) {
    const prev = map.get(rec.user_id) || { first: null, last: null };
    if (rec.created_at) {
      if (!prev.first || String(rec.created_at) < String(prev.first)) prev.first = rec.created_at;
      if (!prev.last || String(rec.created_at) > String(prev.last)) prev.last = rec.created_at;
    }
    map.set(rec.user_id, prev);
  }
  return map;
}
