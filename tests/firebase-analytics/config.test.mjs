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

test("private key em env vence arquivo local mesmo se o JSON existir", () => {
  const result = resolveGa4Config(
    {
      GA4_PROPERTY_ID: "547012679",
      GOOGLE_APPLICATION_CREDENTIALS: "./service.json",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "service@example.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
      GOOGLE_SERVICE_ACCOUNT_PROJECT_ID: "pharus-proj",
    },
    { cwd: "C:/app", existsSync: () => true },
  );
  assert.equal(result.ok, true);
  assert.equal(result.authMode, "environment");
  assert.equal(result.clientOptions.credentials.project_id, "pharus-proj");
  assert.match(result.clientOptions.credentials.private_key, /\nabc\n/);
  assert.equal(result.clientOptions.keyFilename, undefined);
});

test("produção não exige GOOGLE_APPLICATION_CREDENTIALS", () => {
  const result = resolveGa4Config(
    {
      VERCEL: "1",
      NODE_ENV: "production",
      GA4_PROPERTY_ID: "547012679",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "service@example.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "line1\\nline2",
    },
    { cwd: "/var/task", existsSync: () => false },
  );
  assert.equal(result.ok, true);
  assert.equal(result.authMode, "environment");
  assert.equal(result.clientOptions.credentials.private_key, "line1\nline2");
});

test("produção ignora caminho de arquivo local inexistente", () => {
  const result = resolveGa4Config(
    {
      VERCEL: "1",
      GA4_PROPERTY_ID: "547012679",
      GOOGLE_APPLICATION_CREDENTIALS: "./pharus-sa.json",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "service@example.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "k\\n",
    },
    { cwd: "/var/task", existsSync: () => false },
  );
  assert.equal(result.ok, true);
  assert.equal(result.authMode, "environment");
});

test("erro seguro não expõe private key, bearer ou JWT", () => {
  const secret = "-----BEGIN PRIVATE KEY-----\nSUPER_SECRET\n-----END PRIVATE KEY-----";
  const jwt = `${"a".repeat(24)}.${"b".repeat(24)}.${"c".repeat(24)}`;
  const message = safeGa4Error(new Error(`${secret} Bearer abcdefghijklmnopqrstuvwxyz ${jwt}`));
  assert.doesNotMatch(message, /SUPER_SECRET/);
  assert.doesNotMatch(message, /abcdefghijklmnopqrstuvwxyz/);
  assert.doesNotMatch(message, new RegExp(jwt.replaceAll(".", "\\.")));
});
