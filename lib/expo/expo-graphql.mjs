import { getExpoToken } from "./expo-env.mjs";

export const EXPO_GRAPHQL = "https://api.expo.dev/graphql";

export async function expoGraphql(query, variables = {}, { timeoutMs = 15_000 } = {}) {
  const token = getExpoToken();
  if (!token) {
    return { ok: false, code: "missing_token", error: "EXPO_ACCESS_TOKEN não configurado no servidor." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(EXPO_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (error) {
    return {
      ok: false,
      code: error?.name === "AbortError" ? "timeout" : "network_error",
      error: error instanceof Error ? error.message : "Falha de rede ao consultar Expo.",
    };
  } finally {
    clearTimeout(timer);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors?.length) {
    return {
      ok: false,
      code: "graphql_error",
      error: body.errors?.[0]?.message || `HTTP ${response.status}`,
    };
  }
  return { ok: true, data: body.data };
}

export function settledValue(result, fallback) {
  if (result.status === "fulfilled" && result.value && typeof result.value === "object") return result.value;
  return fallback;
}
