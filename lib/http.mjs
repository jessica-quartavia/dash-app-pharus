export function nodeToWebRequest(req) {
  const host = req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "http";
  return new Request(`${proto}://${host}${req.url}`, {
    method: req.method,
    headers: req.headers,
  });
}

export function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}
