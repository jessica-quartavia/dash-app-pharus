import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readApiJson } from "../../js/lib/api-json.mjs";

describe("readApiJson", () => {
  it("não trata HTML 200 como lista vazia de clientes", async () => {
    const response = new Response("<!doctype html>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    await assert.rejects(
      () => readApiJson(response, "falhou"),
      /HTML em vez de JSON/,
    );
  });
});
