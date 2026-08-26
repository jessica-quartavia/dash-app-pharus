import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyAuthUsers,
  isOfficialClient,
  isOfficialPharusClient,
  officialIdSet,
} from "../../lib/app-pharus/clients.mjs";
import { normalizeAuthAdminUser, parseAdminUsersPayload } from "../../lib/data/pharus-auth-admin.mjs";

const member = (overrides = {}) => ({
  id: "a",
  email: "cliente@email.com",
  deleted_at: null,
  raw_app_meta_data: { role: "member" },
  ...overrides,
});

describe("isOfficialPharusClient", () => {
  it("aceita member vivo fora de demo e quartavia", () => {
    assert.equal(isOfficialPharusClient(member()), true);
    assert.equal(isOfficialClient(member()), true);
  });

  it("aceita o formato da Auth Admin API (app_metadata)", () => {
    assert.equal(
      isOfficialPharusClient({
        id: "a",
        email: "cliente@email.com",
        deleted_at: null,
        app_metadata: { role: "member" },
      }),
      true,
    );
  });

  it("aceita e-mail vazio, como COALESCE(email, '') NOT ILIKE", () => {
    assert.equal(isOfficialPharusClient(member({ email: "" })), true);
    assert.equal(isOfficialPharusClient(member({ email: null })), true);
  });

  it("rejeita demo, staff, excluído e sem role member", () => {
    assert.equal(isOfficialPharusClient(member({ email: "x@demo.com.br" })), false);
    assert.equal(isOfficialPharusClient(member({ email: "pessoa@quartavia.com.br" })), false);
    assert.equal(isOfficialPharusClient(member({ email: "OK@DEMO.COM.BR" })), false);
    assert.equal(isOfficialPharusClient(member({ deleted_at: "2026-01-01" })), false);
    assert.equal(isOfficialPharusClient(member({ raw_app_meta_data: {} })), false);
  });

  it("monta o conjunto oficial por id", () => {
    const set = officialIdSet([
      member({ id: "1", email: "a@x.com" }),
      member({ id: "2", email: "b@demo.com.br" }),
    ]);
    assert.equal(set.size, 1);
    assert.equal(set.has("1"), true);
  });

  it("classifica o funil sem misturar PostgREST", () => {
    const counts = classifyAuthUsers([
      member({ id: "1" }),
      member({ id: "2", deleted_at: "2026-01-01" }),
      member({ id: "3", raw_app_meta_data: { role: "admin" } }),
      member({ id: "4", email: "a@demo.com.br" }),
      member({ id: "5", email: "b@quartavia.com.br" }),
    ]);
    assert.equal(counts.received, 5);
    assert.equal(counts.notDeleted, 4);
    assert.equal(counts.members, 3);
    assert.equal(counts.official, 1);
  });

  it("normaliza listUsers para a regra oficial", () => {
    const parsed = parseAdminUsersPayload({
      users: [
        {
          id: "u1",
          email: "ok@email.com",
          created_at: "2026-08-01T12:00:00.000Z",
          app_metadata: { role: "member" },
          user_metadata: { name: "Ana" },
        },
      ],
    });
    const user = normalizeAuthAdminUser(parsed[0]);
    assert.equal(isOfficialPharusClient(user), true);
    assert.equal(user.raw_app_meta_data.role, "member");
  });
});
