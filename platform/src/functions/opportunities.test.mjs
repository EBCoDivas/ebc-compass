import test from "node:test";
import assert from "node:assert/strict";
import { handler } from "./opportunities.mjs";

test("opportunities handler returns the complete demo catalog", async () => {
  const response = await handler();
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.length >= 20, true);
  assert.equal(new Set(body.map((item) => item.type)).size, 6);
});
