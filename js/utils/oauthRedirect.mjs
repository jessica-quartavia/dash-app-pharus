export function resolveOAuthRedirectTo(origin = typeof window !== "undefined" ? window.location.origin : "") {
  const base = String(origin || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("Não foi possível determinar o origin para redirect OAuth.");
  return `${base}/`;
}
