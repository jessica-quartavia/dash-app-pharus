export const AUTH_CACHE_KEY = "qv:authAccess";
export const AUTH_CACHE_TTL_MS = 60 * 60 * 1000;

export function readAuthCache() {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId || !parsed?.email || parsed.authorized !== true) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAuthCache(user) {
  if (!user?.id || !user?.email) return;
  try {
    sessionStorage.setItem(
      AUTH_CACHE_KEY,
      JSON.stringify({
        userId: user.id,
        email: user.email,
        authorized: true,
        checkedAt: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
}

export function clearAuthCache() {
  try {
    sessionStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function cacheCompatible(cache, nextSession) {
  if (!cache || !nextSession?.user) return false;
  return cache.userId === nextSession.user.id && cache.email === nextSession.user.email;
}
