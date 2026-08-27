export function indexProfilesByInternalId(profiles = []) {
  const map = new Map();
  for (const row of profiles) {
    if (row?.internal_id == null) continue;
    map.set(String(row.internal_id), row);
  }
  return map;
}

export function buildCustomerAdvisorMap(allocations = [], profiles = []) {
  const profileMap = indexProfilesByInternalId(profiles);
  const map = new Map();
  for (const row of allocations || []) {
    const customerId = row?.customer_id;
    const internalId = row?.internal_id;
    if (customerId == null || internalId == null) continue;
    const profile = profileMap.get(String(internalId));
    map.set(String(customerId), {
      advisorId: String(internalId),
      advisor: String(profile?.name || "").trim() || "EP sem nome",
    });
  }
  return map;
}

export function listAdvisorOptions(allocations = [], profiles = []) {
  const profileMap = indexProfilesByInternalId(profiles);
  const counts = new Map();
  for (const row of allocations || []) {
    const id = String(row.internal_id);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      name: String(profileMap.get(id)?.name || "").trim() || "EP sem nome",
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
