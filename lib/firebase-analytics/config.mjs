import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_GA4_PROPERTY_ID = "547012679";

function clean(value) {
  return String(value || "").trim();
}

export function isProductionRuntime(env = process.env) {
  return env.VERCEL === "1" || env.NODE_ENV === "production";
}

export function ga4EnvPresence(env = process.env) {
  return {
    GA4_PROPERTY_ID: Boolean(clean(env.GA4_PROPERTY_ID)),
    GOOGLE_SERVICE_ACCOUNT_PROJECT_ID: Boolean(clean(env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID)),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: Boolean(clean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL)),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: Boolean(clean(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)),
    GOOGLE_APPLICATION_CREDENTIALS: Boolean(clean(env.GOOGLE_APPLICATION_CREDENTIALS)),
  };
}

export function resolveGa4Config(env = process.env, options = {}) {
  const fileExists = options.existsSync || existsSync;
  const cwd = options.cwd || process.cwd();
  const propertyId = clean(env.GA4_PROPERTY_ID);
  if (!propertyId) {
    return { ok: false, propertyId: null, authMode: null, errorCode: "GA4_PROPERTY_MISSING" };
  }

  const clientEmail = clean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const privateKey = clean(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).replace(/\\n/g, "\n");
  const projectId = clean(env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID);
  if (clientEmail && privateKey) {
    return {
      ok: true,
      propertyId,
      authMode: "environment",
      clientOptions: {
        ...(projectId ? { projectId } : {}),
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
          ...(projectId ? { project_id: projectId } : {}),
        },
      },
    };
  }

  const credentialsPath = clean(env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!isProductionRuntime(env) && credentialsPath) {
    const keyFilename = resolve(cwd, credentialsPath);
    if (fileExists(keyFilename)) {
      return { ok: true, propertyId, authMode: "file", clientOptions: { keyFilename } };
    }
  }

  return { ok: false, propertyId, authMode: null, errorCode: "GA4_CREDENTIALS_MISSING" };
}

export function safeGa4Error(error) {
  const code = String(error?.code || "").trim();
  const raw = String(error?.message || "Falha ao consultar o Google Analytics.");
  const sanitized = raw
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[credencial protegida]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [protegido]")
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, "[token protegido]")
    .replace(/\s+/g, " ")
    .slice(0, 240);
  return code ? `${code}: ${sanitized}` : sanitized;
}
