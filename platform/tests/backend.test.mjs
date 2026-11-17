import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("both Lambda functions package the shared Spanish prompt and enable system caching by default", () => {
  const context = vm.createContext({
    exports: {},
    process: { env: { BEDROCK_MODEL_ID: "amazon.nova-lite-v1:0" } },
    sst: { aws: { Function: class { constructor(name, args) { this.name = name; this.args = args; } } } },
  });
  const source = readFileSync(new URL("../infra/backend.ts", import.meta.url), "utf8");
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  const root = fileURLToPath(new URL("../", import.meta.url));
  for (const streaming of [false, true]) {
    const { args } = context.exports.createBackend({ streaming, inputGuardrail: { id: "guardrail", arn: "guardrail-arn", version: "1" }, stage: "test", table: { name: "checkpoints" },
      profilesTable: { name: "profiles", arn: "profiles-arn" }, historyTable: { name: "history", arn: "history-arn" }, knowledgeBaseId: "kb", knowledgeBaseArn: "kb-arn" });
    assert.equal(args.environment.BEDROCK_INPUT_GUARDRAIL_ID, 'guardrail');
    assert.equal(args.environment.BEDROCK_INPUT_GUARDRAIL_VERSION, '1');
    assert.ok(args.permissions.some(p => p.actions.includes('bedrock:ApplyGuardrail') && p.resources.includes('guardrail-arn')));
    assert.equal(args.environment.ASSISTANT_PROMPT_CACHE, "system");
    assert.equal(args.environment.ASSISTANT_PROMPTS_DIR, "/var/task/prompts");
    const assets = args.copyFiles.find(({ to }) => to === "prompts");
    assert.ok(assets, "SST must include the prompts in the Lambda package");
    assert.ok(readFileSync(resolve(root, assets.from, "assistant.md"), "utf8").trim());
  }
});
