import assert from "node:assert/strict";
import test from "node:test";
import { resolveGa4Config, safeGa4Error } from "../../lib/firebase-analytics/config.mjs";

test("credencial ausente retorna configuração indisponível", () => {
  const result = resolveGa4Config({ GA4_PROPERTY_ID: "547012679" }, { cwd: "C:/app", existsSync: () => false });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "GA4_CREDENTIALS_MISSING");
});

test("propriedade ausente é distinguida da credencial ausente", () => {
  const result = resolveGa4Config({}, { cwd: "C:/app", existsSync: () => false });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "GA4_PROPERTY_MISSING");
});

test("modo local usa GOOGLE_APPLICATION_CREDENTIALS quando o arquivo existe", () => {
  const result = resolveGa4Config(
    { GA4_PROPERTY_ID: "547012679", GOOGLE_APPLICATION_CREDENTIALS: "./service.json" },
    { cwd: "C:/app", existsSync: () => true },
  );
  assert.equal(result.ok, true);
  assert.equal(result.authMode, "file");
  assert.match(result.clientOptions.keyFilename, /service\.json$/);
  assert.equal(result.clientOptions.credentials, undefined);
});

test("modo Vercel usa e-mail e private key com quebra de linha restaurada", () => {
  const result = resolveGa4Config(
    {
      GA4_PROPERTY_ID: "547012679",
      GOOGLE_APPLICATION_CREDENTIALS: "./missing.json",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "service@example.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "line1\\nline2",
    },
    { cwd: "C:/app", existsSync: () => false },
  );
  assert.equal(result.ok, true);
  assert.equal(result.authMode, "environment");
  assert.equal(result.clientOptions.credentials.private_key, "line1\nline2");
});

test("erro seguro não expõe private key, bearer ou JWT", () => {
  const secret = "-----BEGIN PRIVATE KEY-----\nSUPER_SECRET\n-----END PRIVATE KEY-----";
  const jwt = `${"a".repeat(24)}.${"b".repeat(24)}.${"c".repeat(24)}`;
  const message = safeGa4Error(new Error(`${secret} Bearer abcdefghijklmnopqrstuvwxyz ${jwt}`));
  assert.doesNotMatch(message, /SUPER_SECRET/);
  assert.doesNotMatch(message, /abcdefghijklmnopqrstuvwxyz/);
  assert.doesNotMatch(message, new RegExp(jwt.replaceAll(".", "\\.")));
});
