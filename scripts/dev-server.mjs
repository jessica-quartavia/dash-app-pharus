import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { buildAuthConfigResult } from "../lib/env.mjs";
import { sendJson } from "../lib/http.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(root);
const port = Number(process.env.PORT || 5173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);

  const apiHandlers = {
    "/api/overview": "../api/overview.js",
    "/api/clients": "../api/clients.js",
    "/api/mechanisms": "../api/mechanisms.js",
    "/api/expo/usage": "../api/expo/usage.js",
    "/api/firebase/usage": "../api/firebase/usage.js",
    "/api/dashboard": "../api/dashboard.js",
  };

  if (apiHandlers[url.pathname]) {
    const { default: handler } = await import(apiHandlers[url.pathname]);
    await handler(req, res);
    return;
  }

  if (url.pathname.startsWith("/api/") && url.pathname !== "/api/auth-config") {
    sendJson(res, 404, { error: "Rota não encontrada.", code: "NOT_FOUND" });
    return;
  }

  if (url.pathname === "/api/auth-config") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Método não permitido.", code: "METHOD_NOT_ALLOWED" });
      return;
    }
    const result = buildAuthConfigResult();
    sendJson(res, result.status, result.body, result.headers);
    return;
  }

  let relative = decodeURIComponent(url.pathname);
  if (relative === "/") relative = "/index.html";
  const filePath = normalize(join(root, relative));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": TYPES[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    if (relative.startsWith("/api/")) {
      sendJson(res, 404, { error: "Rota não encontrada.", code: "NOT_FOUND" });
      return;
    }
    if (!extname(relative)) {
      const html = await readFile(join(root, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Dash App Pharus em http://localhost:${port}`);
});
