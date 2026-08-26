export async function readApiJson(response, fallbackError) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const html = contentType.includes("text/html");
    const err = new Error(
      html
        ? `${fallbackError} A rota devolveu HTML em vez de JSON (servidor sem a API ou processo antigo).`
        : `${fallbackError} Resposta não-JSON (${contentType || "sem content-type"}, HTTP ${response.status}).`,
    );
    err.code = "INVALID_API_RESPONSE";
    err.status = response.status;
    throw err;
  }
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    const err = new Error(fallbackError);
    err.code = "INVALID_API_RESPONSE";
    err.status = response.status;
    throw err;
  }
  if (!response.ok) {
    const err = new Error(payload.error || fallbackError);
    err.code = payload.code || "API_ERROR";
    err.status = response.status;
    throw err;
  }
  return payload;
}
