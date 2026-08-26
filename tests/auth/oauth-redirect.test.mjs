import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveOAuthRedirectTo } from "../../js/utils/oauthRedirect.mjs";

describe("resolveOAuthRedirectTo", () => {
  it("usa o origin atual com barra final", () => {
    assert.equal(resolveOAuthRedirectTo("https://meu-app.vercel.app"), "https://meu-app.vercel.app/");
    assert.equal(resolveOAuthRedirectTo("http://localhost:5173/"), "http://localhost:5173/");
  });

  it("não aponta para outro app", () => {
    const redirect = resolveOAuthRedirectTo("https://meu-app.vercel.app");
    assert.equal(redirect.includes("dash-jornada-cliente"), false);
  });
});
