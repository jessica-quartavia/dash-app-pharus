import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedCorporateEmail } from "../../js/corporateEmail.mjs";

describe("isAllowedCorporateEmail", () => {
  it("aceita domínio corporativo exato", () => {
    assert.equal(isAllowedCorporateEmail("user@quartavia.com.br"), true);
    assert.equal(isAllowedCorporateEmail("  ANA@Quartavia.com.br  "), true);
  });

  it("rejeita e-mails fora do domínio", () => {
    assert.equal(isAllowedCorporateEmail("user@gmail.com"), false);
    assert.equal(isAllowedCorporateEmail("user@evilquartavia.com.br"), false);
    assert.equal(isAllowedCorporateEmail("user@quartavia.com.br.evil.com"), false);
    assert.equal(isAllowedCorporateEmail("quartavia.com.br"), false);
    assert.equal(isAllowedCorporateEmail(""), false);
    assert.equal(isAllowedCorporateEmail(null), false);
  });
});
