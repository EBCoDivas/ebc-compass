import assert from "node:assert/strict";
import test from "node:test";
import { handler } from "./health.mjs";

test("health handler returns an OK response and the configured stage", async () => {
  const originalStage = process.env.APP_STAGE;
  process.env.APP_STAGE = "test";

  try {
    const response = await handler();

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-type"], "application/json");
    assert.deepEqual(JSON.parse(response.body), {
      status: "ok",
      stage: "test",
    });
  } finally {
    if (originalStage === undefined) delete process.env.APP_STAGE;
    else process.env.APP_STAGE = originalStage;
  }
});
