import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("Banner alone has read and write access to its actions table", () => {
  const functions = new Map();
  class Function {
    constructor(name, args) { this.arn = name + "-arn"; this.name = name; functions.set(name, args); }
  }
  class Dynamo {
    constructor(name, args) { this.name = name; this.arn = name + "-arn"; assert.equal(args.primaryIndex.rangeKey, "SK"); }
  }
  class Resource { constructor(name) { this.arn = name + "-arn"; this.name = name; } }
  const context = vm.createContext({
    exports: {},
    require: () => ({ STUDENT_CONTEXT_HEADER: "x-compass-student-context", TARGET_NAME: "compass", toolList: [] }),
    sst: { aws: { Function, Dynamo } },
    aws: { getCallerIdentityOutput: () => ({ accountId: "000000000000" }), getRegionOutput: () => ({ region: "us-east-1" }),
      iam: { Role: Resource, RolePolicy: Resource }, bedrock: { AgentcoreGateway: Resource, AgentcoreGatewayTarget: Resource } },
    $interpolate: String.raw,
  });
  const source = readFileSync(new URL("../infra/student-mcp.ts", import.meta.url), "utf8");
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  context.exports.createStudentMcp({ stage: "test", historyTable: { name: "history", arn: "history-arn" }, knowledgeBaseId: "kb", knowledgeBaseArn: "kb-arn" });
  const banner = functions.get("BannerMock");
  assert.equal(banner.environment.BANNER_ACTIONS_TABLE, "BannerActions");
  assert.deepEqual(JSON.parse(JSON.stringify(banner.permissions)), [{ actions: ["dynamodb:GetItem", "dynamodb:PutItem"], resources: ["BannerActions-arn"] }]);
  assert.ok(functions.get("CompassMcpTools").permissions.every(permission => !permission.resources.includes("BannerActions-arn")));
});
