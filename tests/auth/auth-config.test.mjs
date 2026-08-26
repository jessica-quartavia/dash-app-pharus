import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAuthConfigResult } from "../../lib/env.mjs";

describe("buildAuthConfigResult", () => {
  it("retorna AUTH_CONFIG_MISSING sem env", () => {
    const previousUrl = process.env.AUTH_SUPABASE_URL;
    const previousKey = process.env.AUTH_SUPABASE_ANON_KEY;
    delete process.env.AUTH_SUPABASE_URL;
    delete process.env.AUTH_SUPABASE_ANON_KEY;
    const result = buildAuthConfigResult();
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "AUTH_CONFIG_MISSING");
    if (previousUrl) process.env.AUTH_SUPABASE_URL = previousUrl;
    if (previousKey) process.env.AUTH_SUPABASE_ANON_KEY = previousKey;
  });

  it("rejeita service_role no browser", () => {
    process.env.AUTH_SUPABASE_URL = "https://example.supabase.co";
    process.env.AUTH_SUPABASE_ANON_KEY = "service_role.secret";
    const result = buildAuthConfigResult();
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "AUTH_CONFIG_INVALID");
    delete process.env.AUTH_SUPABASE_URL;
    delete process.env.AUTH_SUPABASE_ANON_KEY;
  });
});
