import assert from "node:assert/strict";
import test from "node:test";
import { easCliAllowed } from "../../lib/expo/eas-cli.mjs";
import { envPresence } from "../../lib/env-presence.mjs";

test("EAS CLI fica desligado na Vercel", () => {
  assert.equal(easCliAllowed({ VERCEL: "1" }), false);
  assert.equal(easCliAllowed({ EAS_CLI_DISABLED: "1" }), false);
  assert.equal(easCliAllowed({}), true);
});

test("diagnóstico de env só expõe presença", () => {
  const presence = envPresence({
    GA4_PROPERTY_ID: "123",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "secret",
    EXPO_ACCESS_TOKEN: "token",
  });
  assert.equal(presence.GA4_PROPERTY_ID, true);
  assert.equal(presence.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, true);
  assert.equal(presence.EXPO_ACCESS_TOKEN, true);
  assert.equal(presence.AUTH_SUPABASE_URL, false);
  assert.equal(JSON.stringify(presence).includes("secret"), false);
  assert.equal(JSON.stringify(presence).includes("token"), false);
});
